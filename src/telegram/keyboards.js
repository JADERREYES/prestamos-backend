const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '➕ Crear Cliente' }, { text: '💵 Nuevo Credito' }],
      [{ text: '💰 Registrar Pago' }, { text: '👥 Ver Mis Clientes' }],
      [{ text: '📊 Mi Estado' }, { text: '❓ Ayuda' }]
    ],
    resize_keyboard: true
  }
};

module.exports = {
  mainKeyboard
};
