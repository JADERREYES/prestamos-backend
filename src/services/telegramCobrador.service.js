const bcrypt = require('bcryptjs');
const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');

const normalizeChatId = (chatId) => {
  if (chatId === undefined || chatId === null) return null;
  return String(chatId);
};

const buildTelegramProfile = (from = {}) => ({
  telegramUsername: from.username || '',
  telegramFirstName: from.first_name || '',
});

const autenticarCobradorTelegram = async ({ email, password, chatId, from }) => {
  if (!email || !password) {
    throw new Error('Debes enviar correo y contrasena.');
  }

  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) {
    throw new Error('No se pudo identificar el chat de Telegram.');
  }

  const cobrador = await Cobrador.findOne({
    email: email.toLowerCase().trim(),
    activo: true,
  });

  if (!cobrador) {
    throw new Error('Credenciales invalidas.');
  }

  const passwordValida = await bcrypt.compare(password, cobrador.password);
  if (!passwordValida) {
    throw new Error('Credenciales invalidas.');
  }

  await Cobrador.updateMany(
    { telegramChatId, _id: { $ne: cobrador._id } },
    {
      $set: {
        telegramChatId: null,
        telegramUsername: '',
        telegramFirstName: '',
        telegramActivo: false,
      },
    }
  );

  Object.assign(cobrador, {
    telegramChatId,
    ...buildTelegramProfile(from),
    telegramActivo: true,
  });

  await cobrador.save();

  return cobrador;
};

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

module.exports = {
  autenticarCobradorTelegram,
  obtenerCobradorPorChat,
  obtenerClientesDelCobradorTelegram,
};
