const handleTelegramError = async (ctx, error) => {
  console.error('Error Telegram:', {
    updateId: ctx?.update?.update_id,
    message: error.message
  });

  if (ctx?.reply) {
    await ctx.reply(error.message || 'No se pudo procesar la solicitud.');
  }
};

const replyLoginRequired = (ctx) => (
  ctx.reply('Debes autenticarte primero con /login correo contrasena.')
);

module.exports = {
  handleTelegramError,
  replyLoginRequired
};
