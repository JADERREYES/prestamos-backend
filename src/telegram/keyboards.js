const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: 'Ver mis clientes' }],
      [{ text: 'Crear cliente' }, { text: 'Crear prestamo' }],
      [{ text: 'Registrar pago' }, { text: 'Ayuda' }]
    ],
    resize_keyboard: true
  }
};

module.exports = {
  mainKeyboard
};
