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
  startClienteSession,
  updateConversationSession
};
