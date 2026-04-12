const handleTelegramError = async (ctx, error) => {
  console.error('Error Telegram:', {
    updateId: ctx?.update?.update_id,
    message: error.message
  });

  if (ctx?.reply) {
    await ctx.reply(error.message || 'No se pudo procesar la solicitud.');
  }
};

const replyUnlinkedAccount = (ctx) => (
  ctx.reply('Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.')
);

module.exports = {
  handleTelegramError,
  replyUnlinkedAccount
};
