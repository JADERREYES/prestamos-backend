const { obtenerCobradorPorChat } = require('../services/telegramCobrador.service');

const getAuthenticatedCobrador = async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;
  return obtenerCobradorPorChat(chatId);
};

module.exports = {
  getAuthenticatedCobrador
};
