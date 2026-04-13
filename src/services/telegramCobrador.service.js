const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');
const Pago = require('../models/Pago');
const Prestamo = require('../models/Prestamo');
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

const crearClienteDesdeTelegram = async ({ cobrador, nombre, cedula, telefono, direccion }) => {
  const nombreFinal = String(nombre || '').trim();
  const cedulaFinal = String(cedula || '').trim();
  const telefonoFinal = String(telefono || '').trim();
  const direccionFinal = String(direccion || '').trim() || 'Sin direccion';

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

  if (direccionFinal.length > 120) {
    throw createPublicError('La direccion no debe superar 120 caracteres.');
  }

  const existe = await Cliente.findOne({
    cedula: cedulaFinal,
    tenantId: cobrador.tenantId
  });

  if (existe) {
    throw createPublicError('Ya existe un cliente con esa cedula en esta oficina.');
  }

  let cliente;
  try {
    cliente = await Cliente.create({
      nombre: nombreFinal,
      cedula: cedulaFinal,
      telefono: telefonoFinal,
      direccion: direccionFinal,
      email: '',
      tipo: 'nuevo',
      cobrador: cobrador._id,
      tenantId: cobrador.tenantId,
      activo: true
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createPublicError('Ya existe un cliente con esa cedula en esta oficina.');
    }
    throw error;
  }

  return cliente;
};

const buscarClientePorCedulaTelegram = async (cobrador, cedula) => {
  if (!cobrador) {
    throw createPublicError('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.');
  }

  const cedulaFinal = String(cedula || '').trim();

  if (!cedulaFinal || cedulaFinal.length < 5 || cedulaFinal.length > 30) {
    throw createPublicError('La cedula debe tener entre 5 y 30 caracteres.');
  }

  const cliente = await Cliente.findOne({
    cedula: cedulaFinal,
    tenantId: cobrador.tenantId,
    cobrador: cobrador._id,
    activo: true
  })
    .select('nombre cedula telefono direccion')
    .lean();

  if (!cliente) {
    throw createPublicError('No encontre un cliente activo con esa cedula para tu oficina.');
  }

  return cliente;
};

const listarClientesParaPrestamoTelegram = async (cobrador) => {
  if (!cobrador) {
    throw createPublicError('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.');
  }

  return Cliente.find({
    tenantId: cobrador.tenantId,
    cobrador: cobrador._id,
    activo: true
  })
    .select('nombre cedula telefono createdAt')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
};

const calcularTotalPrestamo = (capital, interes) => (
  Math.round(Number(capital) * (1 + Number(interes || 0) / 100))
);

const buildFechaVencimiento = (fechaInicio, plazo) => {
  const fecha = new Date(fechaInicio);
  fecha.setDate(fecha.getDate() + Number(plazo));
  return fecha;
};

const crearPrestamoDesdeTelegram = async ({ cobrador, clienteId, capital, interes, plazo }) => {
  if (!cobrador) {
    throw createPublicError('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.');
  }

  const capitalNumero = Number(capital);
  const interesNumero = Number(interes);
  const plazoNumero = Number(plazo);

  if (!clienteId) {
    throw createPublicError('Debes seleccionar un cliente valido.');
  }

  if (!Number.isFinite(capitalNumero) || capitalNumero <= 0) {
    throw createPublicError('El capital debe ser un numero mayor a 0.');
  }

  if (!Number.isFinite(interesNumero) || interesNumero < 0) {
    throw createPublicError('El interes debe ser un numero igual o mayor a 0.');
  }

  if (!Number.isFinite(plazoNumero) || plazoNumero <= 0) {
    throw createPublicError('El plazo debe ser un numero mayor a 0.');
  }

  const cliente = await Cliente.findOne({
    _id: clienteId,
    tenantId: cobrador.tenantId,
    cobrador: cobrador._id,
    activo: true
  });

  if (!cliente) {
    throw createPublicError('Cliente no valido para este cobrador.');
  }

  const fechaInicio = new Date();
  const fechaVencimiento = buildFechaVencimiento(fechaInicio, plazoNumero);
  const totalAPagar = calcularTotalPrestamo(capitalNumero, interesNumero);

  const prestamo = await Prestamo.create({
    clienteId: cliente._id,
    capital: capitalNumero,
    interes: interesNumero,
    total: totalAPagar,
    totalAPagar,
    totalPagado: 0,
    plazo: plazoNumero,
    frecuencia: 'diario',
    fechaInicio,
    fechaVencimiento,
    estado: 'activo',
    tenantId: cobrador.tenantId,
    creadoPor: cobrador._id,
    creadoPorRol: 'cobrador'
  });

  return { prestamo, cliente, totalAPagar };
};

const getSaldoPendiente = (prestamo) => (
  Number(prestamo.totalAPagar || 0) - Number(prestamo.totalPagado || 0)
);

const toPayablePrestamo = (prestamo) => ({
  _id: prestamo._id,
  capital: prestamo.capital,
  interes: prestamo.interes,
  totalAPagar: prestamo.totalAPagar,
  totalPagado: prestamo.totalPagado || 0,
  saldoPendiente: getSaldoPendiente(prestamo),
  estado: prestamo.estado,
  createdAt: prestamo.createdAt
});

const listarClientesConPrestamosPagablesTelegram = async (cobrador) => {
  if (!cobrador) {
    throw createPublicError('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.');
  }

  const clientes = await Cliente.find({
    tenantId: cobrador.tenantId,
    cobrador: cobrador._id,
    activo: true
  })
    .select('nombre cedula telefono createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  if (!clientes.length) return [];

  const clienteIds = clientes.map((cliente) => cliente._id);
  const prestamos = await Prestamo.find({
    tenantId: cobrador.tenantId,
    clienteId: { $in: clienteIds },
    estado: 'activo'
  })
    .select('clienteId totalAPagar totalPagado estado')
    .lean();

  const clientesConSaldo = new Set(
    prestamos
      .filter((prestamo) => getSaldoPendiente(prestamo) > 0)
      .map((prestamo) => String(prestamo.clienteId))
  );

  return clientes.filter((cliente) => clientesConSaldo.has(String(cliente._id))).slice(0, 20);
};

const listarPrestamosPagablesClienteTelegram = async (cobrador, clienteId) => {
  if (!cobrador) {
    throw createPublicError('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.');
  }

  const cliente = await Cliente.findOne({
    _id: clienteId,
    tenantId: cobrador.tenantId,
    cobrador: cobrador._id,
    activo: true
  })
    .select('nombre cedula telefono')
    .lean();

  if (!cliente) {
    throw createPublicError('Cliente no valido para este cobrador.');
  }

  const prestamos = await Prestamo.find({
    clienteId: cliente._id,
    tenantId: cobrador.tenantId,
    estado: 'activo'
  })
    .select('capital interes totalAPagar totalPagado estado createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return {
    cliente,
    prestamos: prestamos
      .map(toPayablePrestamo)
      .filter((prestamo) => prestamo.saldoPendiente > 0)
      .slice(0, 20)
  };
};

const listarPrestamosPagablesPorCedulaTelegram = async (cobrador, cedula) => {
  const cliente = await buscarClientePorCedulaTelegram(cobrador, cedula);
  const { prestamos } = await listarPrestamosPagablesClienteTelegram(cobrador, cliente._id);

  return { cliente, prestamos };
};

const registrarPagoDesdeTelegram = async ({ cobrador, prestamoId, monto }) => {
  if (!cobrador) {
    throw createPublicError('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.');
  }

  const montoNumero = Number(monto);
  if (!prestamoId) {
    throw createPublicError('Debes seleccionar un prestamo valido.');
  }

  if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
    throw createPublicError('El monto debe ser un numero mayor a 0.');
  }

  const prestamo = await Prestamo.findOne({
    _id: prestamoId,
    tenantId: cobrador.tenantId
  }).populate('clienteId');

  if (!prestamo || !prestamo.clienteId || String(prestamo.clienteId.cobrador) !== String(cobrador._id)) {
    throw createPublicError('Prestamo no valido para este cobrador.');
  }

  if (prestamo.estado !== 'activo') {
    throw createPublicError('Este prestamo no esta activo.');
  }

  const saldoAnterior = getSaldoPendiente(prestamo);
  if (saldoAnterior <= 0) {
    throw createPublicError('Este prestamo no tiene saldo pendiente.');
  }

  if (montoNumero > saldoAnterior) {
    throw createPublicError(`El monto excede el saldo pendiente. Saldo: ${saldoAnterior}.`);
  }

  const pago = await Pago.create({
    prestamoId: prestamo._id,
    clienteId: prestamo.clienteId._id,
    monto: montoNumero,
    fecha: new Date(),
    registradoPor: cobrador._id,
    tenantId: cobrador.tenantId,
    metodoPago: 'efectivo',
    referencia: 'telegram'
  });

  prestamo.totalPagado = Number(prestamo.totalPagado || 0) + montoNumero;
  if (prestamo.totalPagado >= prestamo.totalAPagar) {
    prestamo.estado = 'pagado';
  }
  prestamo.ultimoPago = new Date();
  await prestamo.save();

  return {
    pago,
    prestamo,
    cliente: prestamo.clienteId,
    saldoAnterior,
    saldoPendiente: getSaldoPendiente(prestamo)
  };
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
  buscarClientePorCedulaTelegram,
  crearClienteDesdeTelegram,
  crearPrestamoDesdeTelegram,
  generarCodigoVinculacion,
  listarClientesConPrestamosPagablesTelegram,
  listarClientesParaPrestamoTelegram,
  listarPrestamosPagablesClienteTelegram,
  listarPrestamosPagablesPorCedulaTelegram,
  obtenerCobradorPorChat,
  obtenerClientesDelCobradorTelegram,
  registrarPagoDesdeTelegram,
  vincularTelegramConCodigo,
};
