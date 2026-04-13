const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '➕ Crear Cliente' }, { text: '💵 Nuevo Crédito' }],
      [{ text: '💰 Registrar Pago' }, { text: '👥 Mis Clientes' }],
      [{ text: '📊 Mi Estado' }, { text: '❓ Ayuda' }]
    ],
    resize_keyboard: true
  }
};

module.exports = {
  mainKeyboard
};
