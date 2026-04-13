const { obtenerCobradorPorChat } = require('../services/telegramCobrador.service');

const conversationSessions = new Map();

const normalizeChatId = (chatId) => {
  if (chatId === undefined || chatId === null) return null;
  return String(chatId);
};

const getAuthenticatedCobrador = async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;
  return obtenerCobradorPorChat(chatId);
};

const startClienteSession = (chatId) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;

  const session = {
    flow: 'crear_cliente',
    step: 'nombre',
    data: {},
    createdAt: new Date()
  };

  conversationSessions.set(telegramChatId, session);
  return session;
};

const startPrestamoSession = (chatId, data = {}) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;

  const session = {
    flow: 'crear_prestamo',
    step: 'cedula',
    data,
    createdAt: new Date()
  };

  conversationSessions.set(telegramChatId, session);
  return session;
};

const startPagoSession = (chatId, data = {}) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;

  const session = {
    flow: 'registrar_pago',
    step: 'cedula',
    data,
    createdAt: new Date()
  };

  conversationSessions.set(telegramChatId, session);
  return session;
};

const setLastCreatedCliente = (chatId, cliente) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId || !cliente) return;
  conversationSessions.set(`${telegramChatId}:lastCliente`, {
    _id: cliente._id,
    nombre: cliente.nombre,
    cedula: cliente.cedula,
    createdAt: new Date()
  });
};

const getLastCreatedCliente = (chatId) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;
  return conversationSessions.get(`${telegramChatId}:lastCliente`) || null;
};

const setLastCreatedPrestamo = (chatId, prestamo, cliente) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId || !prestamo || !cliente) return;
  conversationSessions.set(`${telegramChatId}:lastPrestamo`, {
    _id: prestamo._id,
    capital: prestamo.capital,
    totalAPagar: prestamo.totalAPagar,
    totalPagado: prestamo.totalPagado || 0,
    saldoPendiente: (prestamo.totalAPagar || 0) - (prestamo.totalPagado || 0),
    estado: prestamo.estado,
    cliente: {
      _id: cliente._id,
      nombre: cliente.nombre,
      cedula: cliente.cedula
    },
    createdAt: new Date()
  });
};

const getLastCreatedPrestamo = (chatId) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;
  return conversationSessions.get(`${telegramChatId}:lastPrestamo`) || null;
};

const getConversationSession = (chatId) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;
  return conversationSessions.get(telegramChatId) || null;
};

const updateConversationSession = (chatId, patch) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return null;

  const current = conversationSessions.get(telegramChatId);
  if (!current) return null;

  const next = {
    ...current,
    ...patch,
    data: {
      ...current.data,
      ...(patch.data || {})
    }
  };

  conversationSessions.set(telegramChatId, next);
  return next;
};

const clearConversationSession = (chatId) => {
  const telegramChatId = normalizeChatId(chatId);
  if (!telegramChatId) return;
  conversationSessions.delete(telegramChatId);
};

module.exports = {
  clearConversationSession,
  getAuthenticatedCobrador,
  getConversationSession,
  getLastCreatedCliente,
  getLastCreatedPrestamo,
  setLastCreatedCliente,
  setLastCreatedPrestamo,
  startClienteSession,
  startPagoSession,
  startPrestamoSession,
  updateConversationSession
};
