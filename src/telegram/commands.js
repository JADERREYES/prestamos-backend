const { mainKeyboard } = require('./keyboards');
const { replyUnlinkedAccount } = require('./handlers');
const { responderConRAG } = require('../services/rag.service');
const {
  detectIntent: detectOperationalIntent,
  extractCedula,
  extractExplicitName,
  normalizeText: normalizeOperationalText,
  procesarPreguntaOperativa
} = require('../services/telegramIaOperativa.service');
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
const SEPARATOR = '--------------------';

const HELP_TEXT = [
  'Ayuda del bot',
  '',
  'Usa el menu visible para trabajar mas rapido o escribeme en lenguaje natural.',
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
  '/ia PREGUNTA - Consultar IA de tu oficina',
  '/vincular CODIGO - Vincular este chat',
  '/miid - Ver datos basicos del chat',
  '',
  'Ejemplos:',
  'saldo Angela',
  'saldo 1234567890',
  'pagos pendientes',
  'pagos de hoy',
  'clientes morosos',
  'resumen de mi oficina',
  'requisitos para aprobar prestamo',
  'que hago si un cliente esta en mora'
].join('\n');

const DOCUMENTAL_KEYWORDS = [
  'requisito',
  'politica',
  'manual',
  'procedimiento',
  'proceso',
  'regla',
  'reglas',
  'cobranza',
  'cobro',
  'refinanciacion',
  'refinanciar',
  'pregunta frecuente',
  'preguntas frecuentes',
  'faq',
  'que hago',
  'como debo',
  'como se debe',
  'mora'
];

const GREETING_PATTERNS = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hello'];
const HELP_PATTERNS = ['ayuda', 'help', 'que puedes hacer', 'que haces', 'comandos'];
const CREATE_CLIENT_PATTERNS = ['crear cliente', 'nuevo cliente', 'registrar cliente'];
const CREATE_PRESTAMO_PATTERNS = ['crear prestamo', 'crear prestamo nuevo', 'nuevo prestamo', 'crear credito', 'nuevo credito'];
const CREATE_PAGO_PATTERNS = ['registrar pago', 'nuevo pago', 'crear pago'];

const formatMoney = (value) => Number(value || 0).toLocaleString('es-CO');

const normalizeText = (text) => String(text || '').trim().toLowerCase();

const isCancelText = (text) => {
  const value = normalizeText(text);
  return value === 'cancelar' || value === '/cancelar' || value === 'no';
};

const isYesText = (text) => {
  const value = normalizeText(text);
  return value === 'si' || value === 's' || value === 'ok' || value === '1';
};

const parseMoneyInput = (text) => Number(String(text || '').replace(/[,$.\s]/g, ''));

const parsePercentageInput = (text) => Number(String(text || '').replace('%', '').replace(',', '.').trim());

const parseIntegerInput = (text) => Number(String(text || '').replace(/[.,\s]/g, ''));

const matchesAnyPattern = (text, patterns) => patterns.some((pattern) => text === pattern || text.includes(pattern));

const buildGreetingText = (nombre) => [
  `Hola${nombre ? `, ${nombre}` : ''}. Estoy listo para ayudarte con tu oficina.`,
  'Puedes escribirme cosas como: saldo Angela, pagos pendientes, registrar pago o requisitos para aprobar prestamo.'
].join(' ');

const buildUnknownText = () => (
  'No entendi tu mensaje. Prueba con algo como: saldo Angela, pagos pendientes, registrar pago o requisitos para aprobar prestamo.'
);

const classifyTelegramText = (rawText) => {
  const normalized = normalizeOperationalText(rawText);
  const operationalIntent = detectOperationalIntent(normalized);
  const hasCedula = Boolean(extractCedula(normalized));
  const explicitName = extractExplicitName(normalized);
  const hasClientLookupIntent = /\b(saldo|deuda|debe|estado|historial|cuotas|ultimo pago|ultimo abono)\b/.test(normalized);
  const hasClientStatusNarrative = /^[a-z]+\s+(esta|tiene)\b/.test(normalized) && /\b(mora|atrasad)/.test(normalized);
  const hasClientEntity = Boolean(hasCedula || (hasClientLookupIntent && explicitName) || hasClientStatusNarrative);
  const isDocumental = DOCUMENTAL_KEYWORDS.some((keyword) => normalized.includes(keyword));

  if (!normalized) return { type: 'desconocido' };
  if (GREETING_PATTERNS.includes(normalized)) return { type: 'saludo' };
  if (HELP_PATTERNS.includes(normalized)) return { type: 'ayuda' };
  if (matchesAnyPattern(normalized, CREATE_CLIENT_PATTERNS)) return { type: 'crear_cliente' };
  if (matchesAnyPattern(normalized, CREATE_PRESTAMO_PATTERNS)) return { type: 'crear_prestamo' };
  if (matchesAnyPattern(normalized, CREATE_PAGO_PATTERNS)) return { type: 'registrar_pago' };
  if (isDocumental && (operationalIntent || hasClientEntity)) return { type: 'mixto' };
  if (isDocumental) return { type: 'documental' };
  if (operationalIntent) return { type: 'operativo' };
  return { type: 'desconocido' };
};

const showMainMenu = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await ctx.reply([
      `${APP_NAME}`,
      '',
      'Tu cuenta de Telegram no esta vinculada.',
      'Solicita un codigo al administrador y usa /vincular CODIGO.',
      '',
      'Puedes abrir este menu con /menu.'
    ].join('\n'), mainKeyboard);
    return;
  }

  await ctx.reply([
    `${APP_NAME}`,
    `Hola, ${cobrador.nombre}.`,
    '',
    'Elige una opcion:',
    'Crear Cliente',
    'Nuevo Credito',
    'Registrar Pago',
    'Mis Clientes',
    'Mi Estado',
    'Ayuda'
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

    await ctx.reply(`Tu cuenta fue vinculada correctamente a ${cobrador.nombre}.`, mainKeyboard);
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
      'Bot conectado al backend',
      'Tu cuenta de Telegram no esta vinculada.'
    ].join('\n'), mainKeyboard);
    return;
  }

  await ctx.reply([
    'Bot conectado al backend',
    `Cobrador: ${cobrador.nombre}`,
    `Oficina: ${cobrador.tenantId}`
  ].join('\n'), mainKeyboard);
};

const runIaFlow = async ({ ctx, pregunta, cobrador, classificationType = 'operativo' }) => {
  const resultadoOperativo = await procesarPreguntaOperativa({
    pregunta,
    tenantId: cobrador.tenantId,
    cobrador
  });

  if (classificationType === 'operativo') {
    if (resultadoOperativo?.manejada) {
      await ctx.reply(resultadoOperativo.respuesta, mainKeyboard);
      return;
    }

    await ctx.reply(buildUnknownText(), mainKeyboard);
    return;
  }

  const resultadoDocumental = await responderConRAG(pregunta, {
    tenantId: cobrador.tenantId,
    userRole: 'cobrador'
  });

  if (classificationType === 'documental') {
    await ctx.reply(
      resultadoDocumental?.respuesta || 'No encontre esa informacion en los documentos de esta empresa.',
      mainKeyboard
    );
    return;
  }

  const partes = [];

  if (resultadoOperativo?.manejada && resultadoOperativo.respuesta) {
    partes.push(`Situacion operativa:\n${resultadoOperativo.respuesta}`);
  }

  if (resultadoDocumental?.respuesta) {
    partes.push(`Politica o procedimiento:\n${resultadoDocumental.respuesta}`);
  }

  await ctx.reply(
    partes.join('\n\n') || 'No encontre informacion suficiente para responder esa consulta.',
    mainKeyboard
  );
};

const iaCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);

  const rawText = String(ctx.message?.text || '').trim();
  const pregunta = rawText.replace(/^\/ia(?:@\S+)?\s*/i, '').trim();

  if (!pregunta) {
    await ctx.reply('Escribe tu pregunta despues del comando. Ejemplo: /ia cuanto debe Angela', mainKeyboard);
    return;
  }

  try {
    const cobrador = await getAuthenticatedCobrador(ctx);

    if (!cobrador) {
      await ctx.reply('Tu cuenta de Telegram no esta vinculada. Usa /vincular CODIGO para continuar.', mainKeyboard);
      return;
    }

    if (!cobrador.tenantId) {
      await ctx.reply('No se encontro la oficina asociada a tu usuario.', mainKeyboard);
      return;
    }

    const classification = classifyTelegramText(pregunta);

    if (classification.type === 'documental') {
      await runIaFlow({ ctx, pregunta, cobrador, classificationType: 'documental' });
      return;
    }

    if (classification.type === 'mixto') {
      await runIaFlow({ ctx, pregunta, cobrador, classificationType: 'mixto' });
      return;
    }

    await runIaFlow({ ctx, pregunta, cobrador, classificationType: 'operativo' });
  } catch (error) {
    console.error('Telegram IA | error:', error.message);
    await ctx.reply('Ocurrio un error consultando la IA. Intenta nuevamente.', mainKeyboard);
  }
};

const misClientesCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const { cobrador, clientes } = await obtenerClientesDelCobradorTelegram(ctx.chat?.id);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  if (!clientes.length) {
    await ctx.reply('No tienes clientes activos asignados.', mainKeyboard);
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
    'Tus clientes activos',
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
    'Crear Cliente',
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
    'Nuevo Credito',
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
    'Registrar Pago',
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
    await cancelFlow(ctx, 'Operacion cancelada. No se creo ningun cliente.');
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
      `Nombre: ${text}`,
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
      `Cedula: ${text}`,
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
      `Celular: ${text}`,
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
      `Direccion: ${next.data.direccion}`,
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
        'Cliente creado correctamente.',
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
    await cancelFlow(ctx, 'Operacion cancelada. No se creo ningun credito.');
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
        `Cliente: ${cliente.nombre}`,
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
      `Capital: $${formatMoney(capital)}`,
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
      `Interes: ${interes}%`,
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
        'Credito creado correctamente.',
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
    await cancelFlow(ctx, 'Operacion cancelada. No se registro ningun pago.');
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
          `Cliente: ${cliente.nombre}`,
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
          `Cliente: ${cliente.nombre}`,
          `Saldo pendiente: $${formatMoney(prestamo.saldoPendiente)}`,
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
        `Cliente: ${cliente.nombre}`,
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
      'Prestamo seleccionado.',
      `Saldo pendiente: $${formatMoney(prestamo.saldoPendiente)}`,
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
        'Pago registrado correctamente.',
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

const handleActiveConversation = async (ctx) => {
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

const BUTTON_LABELS = {
  crearCliente: ['Crear Cliente', 'Crear cliente'],
  nuevoCredito: ['Nuevo Credito', 'Nuevo credito', 'Crear prestamo', 'Crear prestamo'],
  registrarPago: ['Registrar Pago', 'Registrar pago'],
  misClientes: ['Mis Clientes', 'Ver mis clientes'],
  miEstado: ['Mi Estado', 'Estado'],
  ayuda: ['Ayuda']
};

const KNOWN_BUTTON_TEXTS = new Set(
  Object.values(BUTTON_LABELS)
    .flat()
    .map((label) => normalizeText(label))
);

const registerButtonHears = (bot, labels, handler) => {
  labels.forEach((label) => bot.hears(label, handler));
};

const handleFreeTextWithoutSession = async (ctx) => {
  const rawText = String(ctx.message?.text || '').trim();

  if (!rawText) return false;
  if (rawText.startsWith('/')) return false;
  if (KNOWN_BUTTON_TEXTS.has(normalizeText(rawText))) return false;

  const classification = classifyTelegramText(rawText);

  if (classification.type === 'saludo') {
    const cobrador = await getAuthenticatedCobrador(ctx);
    await ctx.reply(buildGreetingText(cobrador?.nombre), mainKeyboard);
    return true;
  }

  if (classification.type === 'ayuda') {
    await helpCommand(ctx);
    return true;
  }

  if (classification.type === 'crear_cliente') {
    await startCrearClienteCommand(ctx);
    return true;
  }

  if (classification.type === 'crear_prestamo') {
    await startCrearPrestamoCommand(ctx);
    return true;
  }

  if (classification.type === 'registrar_pago') {
    await startRegistrarPagoCommand(ctx);
    return true;
  }

  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return true;
  }

  if (!cobrador.tenantId) {
    await ctx.reply('No se encontro la oficina asociada a tu usuario.', mainKeyboard);
    return true;
  }

  if (classification.type === 'operativo') {
    await runIaFlow({ ctx, pregunta: rawText, cobrador, classificationType: 'operativo' });
    return true;
  }

  if (classification.type === 'documental') {
    await runIaFlow({ ctx, pregunta: rawText, cobrador, classificationType: 'documental' });
    return true;
  }

  if (classification.type === 'mixto') {
    await runIaFlow({ ctx, pregunta: rawText, cobrador, classificationType: 'mixto' });
    return true;
  }

  await ctx.reply(buildUnknownText(), mainKeyboard);
  return true;
};

const textRouter = async (ctx) => {
  const handledBySession = await handleActiveConversation(ctx);
  if (handledBySession) {
    return true;
  }

  return handleFreeTextWithoutSession(ctx);
};

const registerCommands = (bot) => {
  bot.start(startCommand);
  bot.help(helpCommand);
  bot.command('menu', menuCommand);
  bot.command('vincular', vincularCommand);
  bot.command('ping', pingCommand);
  bot.command('estado', pingCommand);
  bot.command('ia', iaCommand);
  bot.command('miid', whoAmICommand);
  bot.command('whoami', whoAmICommand);
  bot.command('misclientes', misClientesCommand);
  bot.command('cliente', startCrearClienteCommand);
  bot.command('prestamo', startCrearPrestamoCommand);
  bot.command('pago', startRegistrarPagoCommand);
  registerButtonHears(bot, BUTTON_LABELS.crearCliente, startCrearClienteCommand);
  registerButtonHears(bot, BUTTON_LABELS.nuevoCredito, startCrearPrestamoCommand);
  registerButtonHears(bot, BUTTON_LABELS.registrarPago, startRegistrarPagoCommand);
  registerButtonHears(bot, BUTTON_LABELS.misClientes, misClientesCommand);
  registerButtonHears(bot, BUTTON_LABELS.miEstado, pingCommand);
  registerButtonHears(bot, BUTTON_LABELS.ayuda, helpCommand);
  bot.on('text', textRouter);
};

module.exports = {
  classifyTelegramText,
  registerCommands
};
