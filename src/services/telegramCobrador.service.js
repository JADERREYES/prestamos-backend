const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');
const CodigoVinculacionTelegram = require('../models/CodigoVinculacionTelegram');

const CODIGO_TTL_MINUTOS = 15;

const normalizeChatId = (chatId) => {
  if (chatId === undefined || chatId === null) return null;
  return String(chatId);
};

const normalizeCodigo = (codigo) => String(codigo || '').trim().toUpperCase();

const createPublicError = (message) => {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
};

const generarCodigo = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 8; i += 1) {
    codigo += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return codigo;
};

const buildTelegramProfile = (from = {}) => ({
  telegramUsername: from.username || '',
  telegramFirstName: from.first_name || ''
});

const obtenerCobradorPorChat = async (chatId) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;

  return Cobrador.findOne({
    telegramChatId,
    telegramActivo: true,
    activo: true,
  }).select('-password');
};

const obtenerClientesDelCobradorTelegram = async (chatId) => {
  const cobrador = await obtenerCobradorPorChat(chatId);

  if (!cobrador) {
    return { cobrador: null, clientes: [] };
  }

  const clientes = await Cliente.find({
    tenantId: cobrador.tenantId,
    cobrador: cobrador._id,
    activo: true,
  })
    .select('nombre cedula telefono direccion tipo createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return { cobrador, clientes };
};

const crearClienteDesdeTelegram = async ({ cobrador, nombre, cedula, telefono }) => {
  const nombreFinal = String(nombre || '').trim();
  const cedulaFinal = String(cedula || '').trim();
  const telefonoFinal = String(telefono || '').trim();

  if (!cobrador) {
    throw createPublicError('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.');
  }

  if (!nombreFinal || nombreFinal.length < 3 || nombreFinal.length > 80) {
    throw createPublicError('El nombre debe tener entre 3 y 80 caracteres.');
  }

  if (!cedulaFinal || cedulaFinal.length < 5 || cedulaFinal.length > 30) {
    throw createPublicError('La cedula debe tener entre 5 y 30 caracteres.');
  }

  if (!telefonoFinal || telefonoFinal.length < 7 || telefonoFinal.length > 20) {
    throw createPublicError('El telefono debe tener entre 7 y 20 caracteres.');
  }

  const existe = await Cliente.findOne({
    cedula: cedulaFinal,
    tenantId: cobrador.tenantId
  });

  if (existe) {
    throw createPublicError('Ya existe un cliente con esa cedula en esta oficina.');
  }

  const cliente = await Cliente.create({
    nombre: nombreFinal,
    cedula: cedulaFinal,
    telefono: telefonoFinal,
    direccion: '',
    email: '',
    tipo: 'nuevo',
    cobrador: cobrador._id,
    tenantId: cobrador.tenantId,
    activo: true
  });

  return cliente;
};

const generarCodigoVinculacion = async ({ cobrador, creadoPor, creadoPorRol }) => {
  const ahora = new Date();
  const expiraEn = new Date(ahora.getTime() + CODIGO_TTL_MINUTOS * 60 * 1000);

  await CodigoVinculacionTelegram.updateMany(
    {
      cobradorId: cobrador._id,
      estado: 'activo',
      expiraEn: { $gt: ahora }
    },
    { $set: { estado: 'vencido' } }
  );

  for (let intento = 0; intento < 5; intento += 1) {
    try {
      const doc = await CodigoVinculacionTelegram.create({
        codigo: generarCodigo(),
        cobradorId: cobrador._id,
        tenantId: cobrador.tenantId,
        estado: 'activo',
        expiraEn,
        creadoPor,
        creadoPorRol
      });

      return doc;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  throw new Error('No se pudo generar un codigo unico de vinculacion');
};

const vincularTelegramConCodigo = async ({ codigo, chatId, from }) => {
  const codigoNormalizado = normalizeCodigo(codigo);
  const telegramChatId = normalizeChatId(chatId);
  const ahora = new Date();

  if (!codigoNormalizado) {
    throw createPublicError('Debes enviar un codigo de vinculacion.');
  }

  if (!telegramChatId) {
    throw createPublicError('No se pudo identificar este chat de Telegram.');
  }

  const linkCode = await CodigoVinculacionTelegram.findOne({ codigo: codigoNormalizado });

  if (!linkCode) {
    throw createPublicError('El codigo de vinculacion no es valido.');
  }

  if (linkCode.estado === 'usado') {
    throw createPublicError('Este codigo de vinculacion ya fue usado.');
  }

  if (linkCode.estado === 'vencido' || linkCode.estado === 'expirado' || linkCode.expiraEn <= ahora) {
    linkCode.estado = 'vencido';
    await linkCode.save();
    throw createPublicError('Este codigo de vinculacion esta vencido. Solicita uno nuevo al administrador.');
  }

  const cobrador = await Cobrador.findOne({
    _id: linkCode.cobradorId,
    tenantId: linkCode.tenantId,
    activo: true
  });

  if (!cobrador) {
    throw createPublicError('No se encontro el cobrador asociado al codigo.');
  }

  const chatVinculado = await Cobrador.findOne({
    telegramChatId,
    telegramActivo: true,
    _id: { $ne: cobrador._id }
  });

  if (chatVinculado) {
    throw createPublicError('Este chat ya esta vinculado a otro cobrador. Contacta al administrador.');
  }

  if (
    cobrador.telegramActivo &&
    cobrador.telegramChatId &&
    String(cobrador.telegramChatId) !== telegramChatId
  ) {
    throw createPublicError('Este cobrador ya tiene otro chat de Telegram vinculado. Contacta al administrador.');
  }

  Object.assign(cobrador, {
    telegramChatId,
    ...buildTelegramProfile(from),
    telegramActivo: true
  });

  linkCode.estado = 'usado';
  linkCode.usadoEn = ahora;
  linkCode.telegramChatIdUsado = telegramChatId;

  await cobrador.save();
  await linkCode.save();

  return { cobrador, linkCode };
};

module.exports = {
  crearClienteDesdeTelegram,
  generarCodigoVinculacion,
  obtenerCobradorPorChat,
  obtenerClientesDelCobradorTelegram,
  vincularTelegramConCodigo,
};
