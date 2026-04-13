const { mainKeyboard } = require('./keyboards');
const { replyUnlinkedAccount } = require('./handlers');
const {
  clearConversationSession,
  getAuthenticatedCobrador,
  getConversationSession,
  startClienteSession,
  updateConversationSession
} = require('./sessions');
const {
  crearClienteDesdeTelegram,
  obtenerClientesDelCobradorTelegram,
  vincularTelegramConCodigo
} = require('../services/telegramCobrador.service');

const HELP_TEXT = [
  'Comandos disponibles:',
  '/start - Iniciar el bot',
  '/menu - Abrir el menu principal',
  '/help - Ver ayuda',
  '/vincular CODIGO - Vincular este chat con tu usuario cobrador',
  '/ping - Verificar conexion con el backend',
  '/estado - Verificar conexion con el backend',
  '/cliente - Crear un cliente nuevo',
  '/miid - Ver datos basicos de este chat',
  '/whoami - Ver datos basicos de este chat',
  '/misclientes - Ver tus clientes asignados',
  '',
  'Tambien puedes usar el menu visible del chat.'
].join('\n');

const showMainMenu = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);
  const status = cobrador
    ? `Chat vinculado a ${cobrador.nombre}.`
    : 'Tu cuenta de Telegram no esta vinculada. Solicita un codigo al administrador.';

  await ctx.reply(`Bienvenido al bot de prestamos.\n${status}\n\nElige una opcion del menu.`, mainKeyboard);
};

const startCommand = async (ctx) => {
  await showMainMenu(ctx);
};

const menuCommand = async (ctx) => {
  await showMainMenu(ctx);
};

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
  ].join('\n'));
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

    await ctx.reply(`Tu cuenta de Telegram fue vinculada correctamente al cobrador ${cobrador.nombre} de la oficina ${cobrador.tenantId}.`, mainKeyboard);
  } catch (error) {
    await ctx.reply(error.publicMessage || 'No se pudo vincular este chat. Contacta al administrador.');
  }
};

const pingCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await ctx.reply('Bot conectado al backend.\nTu cuenta de Telegram no esta vinculada.');
    return;
  }

  await ctx.reply([
    'Bot conectado al backend.',
    `Cobrador: ${cobrador.nombre}`,
    `Oficina: ${cobrador.tenantId}`
  ].join('\n'));
};

const misClientesCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const { cobrador, clientes } = await obtenerClientesDelCobradorTelegram(ctx.chat?.id);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  if (!clientes.length) {
    await ctx.reply('No tienes clientes activos asignados.');
    return;
  }

  const lines = clientes.slice(0, 20).map((cliente, index) => (
    `${index + 1}. ${cliente.nombre} - ${cliente.telefono || 'Sin telefono'} - ${cliente.direccion || 'Sin direccion'}`
  ));

  const suffix = clientes.length > 20
    ? `\n\nMostrando 20 de ${clientes.length} clientes.`
    : '';

  await ctx.reply(`Tus clientes activos:\n${lines.join('\n')}${suffix}`);
};

const startCrearClienteCommand = async (ctx) => {
  clearConversationSession(ctx.chat?.id);
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  startClienteSession(ctx.chat?.id);
  await ctx.reply('Vamos a crear un cliente. Escribe el nombre completo o responde cancelar para salir.');
};

const isCancelText = (text) => {
  const value = String(text || '').trim().toLowerCase();
  return value === 'cancelar' || value === '/cancelar' || value === 'no';
};

const handleClienteConversation = async (ctx) => {
  const session = getConversationSession(ctx.chat?.id);
  if (!session || session.flow !== 'crear_cliente') {
    return false;
  }

  const text = String(ctx.message?.text || '').trim();

  if (isCancelText(text)) {
    clearConversationSession(ctx.chat?.id);
    await ctx.reply('Creacion de cliente cancelada.', mainKeyboard);
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
      await ctx.reply('El nombre debe tener entre 3 y 80 caracteres. Escribe el nombre nuevamente o cancelar.');
      return true;
    }

    updateConversationSession(ctx.chat?.id, {
      step: 'cedula',
      data: { nombre: text }
    });
    await ctx.reply('Ahora escribe la cedula del cliente.');
    return true;
  }

  if (session.step === 'cedula') {
    if (text.length < 5 || text.length > 30) {
      await ctx.reply('La cedula debe tener entre 5 y 30 caracteres. Escribela nuevamente o cancelar.');
      return true;
    }

    updateConversationSession(ctx.chat?.id, {
      step: 'telefono',
      data: { cedula: text }
    });
    await ctx.reply('Ahora escribe el telefono del cliente.');
    return true;
  }

  if (session.step === 'telefono') {
    if (text.length < 7 || text.length > 20) {
      await ctx.reply('El telefono debe tener entre 7 y 20 caracteres. Escribelo nuevamente o cancelar.');
      return true;
    }

    const next = updateConversationSession(ctx.chat?.id, {
      step: 'confirmar',
      data: { telefono: text }
    });

    await ctx.reply([
      'Confirma los datos del cliente:',
      `Nombre: ${next.data.nombre}`,
      `Cedula: ${next.data.cedula}`,
      `Telefono: ${next.data.telefono}`,
      '',
      'Responde SI para guardar o NO para cancelar.'
    ].join('\n'));
    return true;
  }

  if (session.step === 'confirmar') {
    if (text.toLowerCase() !== 'si' && text.toLowerCase() !== 'sí') {
      await ctx.reply('Responde SI para guardar o NO para cancelar.');
      return true;
    }

    try {
      const cliente = await crearClienteDesdeTelegram({
        cobrador,
        nombre: session.data.nombre,
        cedula: session.data.cedula,
        telefono: session.data.telefono
      });

      clearConversationSession(ctx.chat?.id);
      await ctx.reply(`Cliente creado correctamente: ${cliente.nombre}.`, mainKeyboard);
    } catch (error) {
      clearConversationSession(ctx.chat?.id);
      await ctx.reply(error.publicMessage || 'No se pudo crear el cliente.', mainKeyboard);
    }

    return true;
  }

  clearConversationSession(ctx.chat?.id);
  await ctx.reply('Sesion de cliente reiniciada. Usa /cliente para empezar de nuevo.', mainKeyboard);
  return true;
};

const pendingFeatureCommand = async (ctx) => {
  const cobrador = await getAuthenticatedCobrador(ctx);

  if (!cobrador) {
    await replyUnlinkedAccount(ctx);
    return;
  }

  await ctx.reply('Funcion en preparacion.');
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
  bot.hears('Ver mis clientes', misClientesCommand);
  bot.hears('Ayuda', helpCommand);
  bot.hears('Crear cliente', startCrearClienteCommand);
  bot.hears('Crear prestamo', pendingFeatureCommand);
  bot.hears('Registrar pago', pendingFeatureCommand);
  bot.on('text', handleClienteConversation);
};

module.exports = {
  registerCommands
};
