const { mainKeyboard } = require('./keyboards');
const { replyUnlinkedAccount } = require('./handlers');
const {
  clearConversationSession,
  getAuthenticatedCobrador,
  getConversationSession,
  setLastCreatedCliente,
  setLastCreatedPrestamo,
  startClienteSession,
  startPagoSession,
  startPrestamoSession,
  updateConversationSession
} = require('./sessions');
const {
  buscarClientePorCedulaTelegram,
  crearClienteDesdeTelegram,
  crearPrestamoDesdeTelegram,
  listarPrestamosPagablesPorCedulaTelegram,
  obtenerClientesDelCobradorTelegram,
  registrarPagoDesdeTelegram,
  vincularTelegramConCodigo
} = require('../services/telegramCobrador.service');

const APP_NAME = process.env.TELEGRAM_BUSINESS_NAME || process.env.APP_NAME || 'Prestamos';
const SEPARATOR = '━━━━━━━━━━━━━━━━━━━━';

const HELP_TEXT = [
  '❓ Ayuda del bot',
  '',
  'Usa el menu visible para trabajar mas rapido.',
  '',
  'Comandos disponibles:',
  '/start - Iniciar el bot',
  '/menu - Abrir el menu principal',
  '/cliente - Crear cliente',
  '/prestamo - Crear credito',
  '/pago - Registrar pago',
  '/misclientes - Ver clientes asignados',
  '/ping - Ver conexion',
  '/estado - Ver estado',
  '/vincular CODIGO - Vincular este chat',
  '/miid - Ver datos basicos del chat'
].join('\n');

const formatMoney = (value) => Number(value || 0).toLocaleString('es-CO');

const normalizeText = (text) => String(text || '').trim().toLowerCase();

const isCancelText = (text) => {
  const value = normalizeText(text);
  return value === 'cancelar' || value === '/cancelar' || value === 'no';
};

const isYesText = (text) => {
  const value = normalizeText(text);
  return value === 'si' || value === 'sí' || value === 's' || value === 'ok' || value === '1';
};

const parseMoneyInput = (text) => Number(String(text || '').replace(/[,$.\s]/g, ''));

const parsePercentageInput = (text) => Number(String(text || '').replace('%', '').replace(',', '.').trim());

const parseIntegerInput = (text) => Number(String(text || '').replace(/[.,\s]/g, ''));

const showMainMenu = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await ctx.reply([
      `🏦 ${APP_NAME}`,
      '',
      'Tu cuenta de Telegram no esta vinculada.',
      'Solicita un codigo al administrador y usa /vincular CODIGO.',
      '',
      'Puedes abrir este menu con /menu.'
    ].join('\n'), mainKeyboard);
    return;
  }

  await ctx.reply([
    `🏦 ${APP_NAME}`,
    `Hola, ${cobrador.nombre}.`,
    '',
    'Elige una opcion:',
    '➕ Crear Cliente',
    '💵 Nuevo Credito',
    '💰 Registrar Pago',
    '👥 Ver Mis Clientes',
    '📊 Mi Estado',
    '❓ Ayuda'
  ].join('\n'), mainKeyboard);
};

const startCommand = async (ctx) => showMainMenu(ctx);

const menuCommand = async (ctx) => showMainMenu(ctx);

const helpCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  await ctx.reply(HELP_TEXT, mainKeyboard);
};

const whoAmICommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  await ctx.reply([
    'Datos de este chat:',
    `telegramChatId: ${ctx.chat?.id || 'No disponible'}`,
    `telegramUsername: ${ctx.from?.username || 'No disponible'}`,
    `telegramFirstName: ${ctx.from?.first_name || 'No disponible'}`
  ].join('\n'), mainKeyboard);
};

const vincularCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const text = ctx.message?.text || '';
  const [, codigo] = text.trim().split(/\s+/);

  if (!codigo) {
    await ctx.reply('Uso correcto: /vincular CODIGO');
    return;
  }

  try {
    const { cobrador } = await vincularTelegramConCodigo({
      codigo,
      chatId: ctx.chat?.id,
      from: ctx.from
    });

    await ctx.reply(`✅ Tu cuenta fue vinculada correctamente a ${cobrador.nombre}.`, mainKeyboard);
    await showMainMenu(ctx);
  } catch (error) {
    await ctx.reply(error.publicMessage || 'No se pudo vincular este chat. Contacta al administrador.', mainKeyboard);
  }
};

const pingCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await ctx.reply([
      '✅ Bot conectado al backend',
      'Tu cuenta de Telegram no esta vinculada.'
    ].join('\n'), mainKeyboard);
    return;
  }

  await ctx.reply([
    '✅ Bot conectado al backend',
    `👤 Cobrador: ${cobrador.nombre}`,
    `🏢 Oficina: ${cobrador.tenantId}`
  ].join('\n'), mainKeyboard);
};

const misClientesCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const { cobrador, clientes } = await obtenerClientesDelCobradorTelegram(ctx.chat?.id);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  if (!clientes.length) {
    await ctx.reply('👥 No tienes clientes activos asignados.', mainKeyboard);
    return;
  }

  const visibles = clientes.slice(0, 15);
  const lines = visibles.map((cliente, index) => (
    `${index + 1}. ${cliente.nombre}\n   Cedula: ${cliente.cedula}\n   Celular: ${cliente.telefono || 'Sin celular'}`
  ));

  const suffix = clientes.length > visibles.length
    ? `\n\nMostrando ${visibles.length} de ${clientes.length} clientes.`
    : '';

  await ctx.reply([
    '👥 Tus clientes activos',
    SEPARATOR,
    ...lines,
    SEPARATOR,
    suffix.trim()
  ].filter(Boolean).join('\n'), mainKeyboard);
};

const startCrearClienteCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  startClienteSession(ctx.chat?.id);
  await ctx.reply([
    '➕ Crear Cliente',
    '',
    '1/4 Nombre completo.',
    'Escribe cancelar para salir.'
  ].join('\n'));
};

const startCrearPrestamoCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  startPrestamoSession(ctx.chat?.id);
  await ctx.reply([
    '💵 Nuevo Credito',
    '',
    '1/4 Cedula del cliente.',
    'Escribe cancelar para salir.'
  ].join('\n'));
};

const startRegistrarPagoCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  startPagoSession(ctx.chat?.id);
  await ctx.reply([
    '💰 Registrar Pago',
    '',
    '1/3 Cedula del cliente.',
    'Escribe cancelar para salir.'
  ].join('\n'));
};

const cancelFlow = async (ctx, message) => {
  clearConversationSession(ctx.chat?.id);
  await ctx.reply(message, mainKeyboard);
  await showMainMenu(ctx);
};

const handleClienteConversation = async (ctx, session) => {
  const text = String(ctx.message?.text || '').trim();

  if (isCancelText(text)) {
    await cancelFlow(ctx, '✅ Operacion cancelada. No se creo ningun cliente.');
    return true;
  }

  const cobrador = await getAuthenticatedCobrador(ctx);
  if (!cobrador) {
    clearConversationSession(ctx.chat?.id);
    await replyUnlinkedAccount(ctx);
    return true;
  }

  if (session.step === 'nombre') {
    if (text.length < 3 || text.length > 80) {
      await ctx.reply('Nombre invalido. Escribe nombre completo o cancelar.');
      return true;
    }

    updateConversationSession(ctx.chat?.id, {
      step: 'cedula',
      data: { nombre: text }
    });

    await ctx.reply([
      `✅ Nombre: ${text}`,
      '',
      '2/4 Cedula.'
    ].join('\n'));
    return true;
  }

  if (session.step === 'cedula') {
    if (text.length < 5 || text.length > 30) {
      await ctx.reply('Cedula invalida. Escribela de nuevo o cancelar.');
      return true;
    }

    updateConversationSession(ctx.chat?.id, {
      step: 'telefono',
      data: { cedula: text }
    });

    await ctx.reply([
      `✅ Cedula: ${text}`,
      '',
      '3/4 Celular.'
    ].join('\n'));
    return true;
  }

  if (session.step === 'telefono') {
    if (text.length < 7 || text.length > 20) {
      await ctx.reply('Celular invalido. Escribelo de nuevo o cancelar.');
      return true;
    }

    updateConversationSession(ctx.chat?.id, {
      step: 'direccion',
      data: { telefono: text }
    });

    await ctx.reply([
      `✅ Celular: ${text}`,
      '',
      '4/4 Direccion.',
      'Si no la tienes: sin direccion'
    ].join('\n'));
    return true;
  }

  if (session.step === 'direccion') {
    const direccion = normalizeText(text) === 'sin direccion' ? 'Sin direccion' : text;

    if (direccion.length > 120) {
      await ctx.reply('Direccion muy larga. Escribela mas corta o cancelar.');
      return true;
    }

    const next = updateConversationSession(ctx.chat?.id, {
      step: 'confirmar',
      data: { direccion: direccion || 'Sin direccion' }
    });

    await ctx.reply([
      `✅ Direccion: ${next.data.direccion}`,
      '',
      SEPARATOR,
      'Cliente listo:',
      '',
      `Nombre: ${next.data.nombre}`,
      `Cedula: ${next.data.cedula}`,
      `Celular: ${next.data.telefono}`,
      `Direccion: ${next.data.direccion}`,
      SEPARATOR,
      '',
      'Confirmar? Responde SI u OK.'
    ].join('\n'));
    return true;
  }

  if (session.step === 'confirmar') {
    if (!isYesText(text)) {
      await ctx.reply('Confirma con SI u OK. Para salir responde NO o cancelar.');
      return true;
    }

    try {
      const cliente = await crearClienteDesdeTelegram({
        cobrador,
        nombre: session.data.nombre,
        cedula: session.data.cedula,
        telefono: session.data.telefono,
        direccion: session.data.direccion
      });

      clearConversationSession(ctx.chat?.id);
      setLastCreatedCliente(ctx.chat?.id, cliente);
      await ctx.reply([
        '✅ Cliente creado correctamente.',
        `Nombre: ${cliente.nombre}`,
        `Cedula: ${cliente.cedula}`
      ].join('\n'), mainKeyboard);
      await showMainMenu(ctx);
    } catch (error) {
      clearConversationSession(ctx.chat?.id);
      await ctx.reply(error.publicMessage || 'No se pudo crear el cliente.', mainKeyboard);
      await showMainMenu(ctx);
    }

    return true;
  }

  await cancelFlow(ctx, 'La sesion de cliente se reinicio. Vuelve a intentarlo desde el menu.');
  return true;
};

const handlePrestamoConversation = async (ctx, session) => {
  const text = String(ctx.message?.text || '').trim();

  if (isCancelText(text)) {
    await cancelFlow(ctx, '✅ Operacion cancelada. No se creo ningun credito.');
    return true;
  }

  const cobrador = await getAuthenticatedCobrador(ctx);
  if (!cobrador) {
    clearConversationSession(ctx.chat?.id);
    await replyUnlinkedAccount(ctx);
    return true;
  }

  if (session.step === 'cedula') {
    try {
      const cliente = await buscarClientePorCedulaTelegram(cobrador, text);
      updateConversationSession(ctx.chat?.id, {
        step: 'capital',
        data: { cliente }
      });

      await ctx.reply([
        `✅ Cliente: ${cliente.nombre}`,
        `Cedula: ${cliente.cedula}`,
        '',
        '2/4 Valor del credito.'
      ].join('\n'));
    } catch (error) {
      await ctx.reply([
        error.publicMessage || 'No encontre ese cliente.',
        'Escribe otra cedula o cancelar.'
      ].join('\n'));
    }

    return true;
  }

  if (session.step === 'capital') {
    const capital = parseMoneyInput(text);

    if (!Number.isFinite(capital) || capital <= 0) {
      await ctx.reply('Valor invalido. Ejemplo: 500000. Escribelo de nuevo o cancelar.');
      return true;
    }

    updateConversationSession(ctx.chat?.id, {
      step: 'interes',
      data: { capital }
    });

    await ctx.reply([
      `✅ Capital: $${formatMoney(capital)}`,
      '',
      '3/4 Interes %.',
      'Ejemplo: 20'
    ].join('\n'));
    return true;
  }

  if (session.step === 'interes') {
    const interes = parsePercentageInput(text);

    if (!Number.isFinite(interes) || interes < 0 || interes > 1000) {
      await ctx.reply('Interes invalido. Ejemplo: 20. Escribelo de nuevo o cancelar.');
      return true;
    }

    updateConversationSession(ctx.chat?.id, {
      step: 'cuotas',
      data: { interes }
    });

    await ctx.reply([
      `✅ Interes: ${interes}%`,
      '',
      '4/4 Numero de cuotas.',
      'Ejemplo: 30'
    ].join('\n'));
    return true;
  }

  if (session.step === 'cuotas') {
    const cuotas = parseIntegerInput(text);

    if (!Number.isInteger(cuotas) || cuotas <= 0 || cuotas > 1000) {
      await ctx.reply('Cuotas invalidas. Ejemplo: 30. Escribelas de nuevo o cancelar.');
      return true;
    }

    const totalAPagar = Math.round(session.data.capital * (1 + session.data.interes / 100));
    const valorCuota = Math.ceil(totalAPagar / cuotas);
    const next = updateConversationSession(ctx.chat?.id, {
      step: 'confirmar',
      data: { cuotas, plazo: cuotas, totalAPagar, valorCuota }
    });

    await ctx.reply([
      SEPARATOR,
      'Credito listo:',
      '',
      `Cliente: ${next.data.cliente.nombre}`,
      `Capital: $${formatMoney(next.data.capital)}`,
      `Interes: ${next.data.interes}%`,
      `Cuotas: ${next.data.cuotas}`,
      `Total a pagar: $${formatMoney(next.data.totalAPagar)}`,
      `Valor cuota aprox: $${formatMoney(next.data.valorCuota)}`,
      SEPARATOR,
      '',
      'Confirmar? Responde SI u OK.'
    ].join('\n'));
    return true;
  }

  if (session.step === 'confirmar') {
    if (!isYesText(text)) {
      await ctx.reply('Confirma con SI u OK. Para salir responde NO o cancelar.');
      return true;
    }

    try {
      const { prestamo, cliente, totalAPagar } = await crearPrestamoDesdeTelegram({
        cobrador,
        clienteId: session.data.cliente._id,
        capital: session.data.capital,
        interes: session.data.interes,
        plazo: session.data.plazo
      });

      clearConversationSession(ctx.chat?.id);
      setLastCreatedPrestamo(ctx.chat?.id, prestamo, cliente);
      await ctx.reply([
        '✅ Credito creado correctamente.',
        `Cliente: ${cliente.nombre}`,
        `Total a pagar: $${formatMoney(totalAPagar)}`,
        `Cuota aprox: $${formatMoney(session.data.valorCuota)}`
      ].join('\n'), mainKeyboard);
      await showMainMenu(ctx);
    } catch (error) {
      clearConversationSession(ctx.chat?.id);
      await ctx.reply(error.publicMessage || 'No se pudo crear el credito.', mainKeyboard);
      await showMainMenu(ctx);
    }

    return true;
  }

  await cancelFlow(ctx, 'La sesion de credito se reinicio. Vuelve a intentarlo desde el menu.');
  return true;
};

const renderPrestamosPago = (prestamos) => {
  const lines = prestamos.map((prestamo, index) => (
    `${index + 1}. Saldo $${formatMoney(prestamo.saldoPendiente)} - Capital $${formatMoney(prestamo.capital)}`
  ));

  return [
    'Este cliente tiene varios prestamos activos.',
    'Selecciona cual quieres pagar:',
    ...lines,
    '',
    'Responde con el numero o cancelar.'
  ].join('\n');
};

const handlePagoConversation = async (ctx, session) => {
  const text = String(ctx.message?.text || '').trim();

  if (isCancelText(text)) {
    await cancelFlow(ctx, '✅ Operacion cancelada. No se registro ningun pago.');
    return true;
  }

  const cobrador = await getAuthenticatedCobrador(ctx);
  if (!cobrador) {
    clearConversationSession(ctx.chat?.id);
    await replyUnlinkedAccount(ctx);
    return true;
  }

  if (session.step === 'cedula') {
    try {
      const { cliente, prestamos } = await listarPrestamosPagablesPorCedulaTelegram(cobrador, text);

      if (!prestamos.length) {
        clearConversationSession(ctx.chat?.id);
        await ctx.reply([
          `✅ Cliente: ${cliente.nombre}`,
          'Este cliente no tiene prestamos activos con saldo pendiente.'
        ].join('\n'), mainKeyboard);
        await showMainMenu(ctx);
        return true;
      }

      if (prestamos.length === 1) {
        const prestamo = prestamos[0];
        updateConversationSession(ctx.chat?.id, {
          step: 'monto',
          data: { cliente, prestamo }
        });

        await ctx.reply([
          `✅ Cliente: ${cliente.nombre}`,
          `💳 Saldo pendiente: $${formatMoney(prestamo.saldoPendiente)}`,
          '',
          '2/3 Monto del pago.'
        ].join('\n'));
        return true;
      }

      updateConversationSession(ctx.chat?.id, {
        step: 'prestamo',
        data: { cliente, prestamos }
      });
      await ctx.reply([
        `✅ Cliente: ${cliente.nombre}`,
        renderPrestamosPago(prestamos)
      ].join('\n\n'));
    } catch (error) {
      await ctx.reply([
        error.publicMessage || 'No encontre prestamos para ese cliente.',
        'Escribe otra cedula o cancelar.'
      ].join('\n'));
    }

    return true;
  }

  if (session.step === 'prestamo') {
    const selectedIndex = parseIntegerInput(text);
    const prestamos = session.data.prestamos || [];

    if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > prestamos.length) {
      await ctx.reply(`Seleccion invalida. Elige 1 a ${prestamos.length}, o cancelar.`);
      return true;
    }

    const prestamo = prestamos[selectedIndex - 1];
    updateConversationSession(ctx.chat?.id, {
      step: 'monto',
      data: { prestamo }
    });

    await ctx.reply([
      `✅ Prestamo seleccionado.`,
      `💳 Saldo pendiente: $${formatMoney(prestamo.saldoPendiente)}`,
      '',
      '2/3 Monto del pago.'
    ].join('\n'));
    return true;
  }

  if (session.step === 'monto') {
    const monto = parseMoneyInput(text);
    const saldoPendiente = Number(session.data.prestamo?.saldoPendiente || 0);

    if (!Number.isFinite(monto) || monto <= 0) {
      await ctx.reply('Monto invalido. Ejemplo: 50000. Escribelo de nuevo o cancelar.');
      return true;
    }

    if (saldoPendiente > 0 && monto > saldoPendiente) {
      await ctx.reply(`Monto mayor al saldo: $${formatMoney(saldoPendiente)}. Escribelo de nuevo o cancelar.`);
      return true;
    }

    const next = updateConversationSession(ctx.chat?.id, {
      step: 'confirmar',
      data: { monto }
    });

    await ctx.reply([
      SEPARATOR,
      'Pago listo:',
      '',
      `Cliente: ${next.data.cliente.nombre}`,
      `Saldo actual: $${formatMoney(next.data.prestamo.saldoPendiente)}`,
      `Monto: $${formatMoney(next.data.monto)}`,
      SEPARATOR,
      '',
      'Confirmar? Responde SI u OK.'
    ].join('\n'));
    return true;
  }

  if (session.step === 'confirmar') {
    if (!isYesText(text)) {
      await ctx.reply('Confirma con SI u OK. Para salir responde NO o cancelar.');
      return true;
    }

    try {
      const { pago, cliente, saldoAnterior, saldoPendiente, prestamo } = await registrarPagoDesdeTelegram({
        cobrador,
        prestamoId: session.data.prestamo._id,
        monto: session.data.monto
      });

      clearConversationSession(ctx.chat?.id);
      await ctx.reply([
        '✅ Pago registrado correctamente.',
        `Cliente: ${cliente.nombre}`,
        `Monto: $${formatMoney(pago.monto)}`,
        `Saldo anterior: $${formatMoney(saldoAnterior)}`,
        `Saldo pendiente: $${formatMoney(saldoPendiente)}`,
        `Estado del credito: ${prestamo.estado}`
      ].join('\n'), mainKeyboard);
      await showMainMenu(ctx);
    } catch (error) {
      clearConversationSession(ctx.chat?.id);
      await ctx.reply(error.publicMessage || 'No se pudo registrar el pago.', mainKeyboard);
      await showMainMenu(ctx);
    }

    return true;
  }

  await cancelFlow(ctx, 'La sesion de pago se reinicio. Vuelve a intentarlo desde el menu.');
  return true;
};

const conversationRouter = async (ctx) => {
  const session = getConversationSession(ctx.chat?.id);
  if (!session) return false;

  if (session.flow === 'crear_cliente') {
    return handleClienteConversation(ctx, session);
  }

  if (session.flow === 'crear_prestamo') {
    return handlePrestamoConversation(ctx, session);
  }

  if (session.flow === 'registrar_pago') {
    return handlePagoConversation(ctx, session);
  }

  return false;
};

const registerCommands = (bot) => {
  bot.start(startCommand);
  bot.help(helpCommand);
  bot.command('menu', menuCommand);
  bot.command('vincular', vincularCommand);
  bot.command('ping', pingCommand);
  bot.command('estado', pingCommand);
  bot.command('miid', whoAmICommand);
  bot.command('whoami', whoAmICommand);
  bot.command('misclientes', misClientesCommand);
  bot.command('cliente', startCrearClienteCommand);
  bot.command('prestamo', startCrearPrestamoCommand);
  bot.command('pago', startRegistrarPagoCommand);
  bot.hears('➕ Crear Cliente', startCrearClienteCommand);
  bot.hears('Crear cliente', startCrearClienteCommand);
  bot.hears('💵 Nuevo Credito', startCrearPrestamoCommand);
  bot.hears('Crear prestamo', startCrearPrestamoCommand);
  bot.hears('💰 Registrar Pago', startRegistrarPagoCommand);
  bot.hears('Registrar pago', startRegistrarPagoCommand);
  bot.hears('👥 Ver Mis Clientes', misClientesCommand);
  bot.hears('Ver mis clientes', misClientesCommand);
  bot.hears('📊 Mi Estado', pingCommand);
  bot.hears('❓ Ayuda', helpCommand);
  bot.hears('Ayuda', helpCommand);
  bot.on('text', conversationRouter);
};

module.exports = {
  registerCommands
};
