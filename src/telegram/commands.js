const { mainKeyboard } = require('./keyboards');
const { replyUnlinkedAccount } = require('./handlers');
const { getAuthenticatedCobrador } = require('./sessions');
const {
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
  '/miid - Ver datos basicos de este chat',
  '/whoami - Ver datos basicos de este chat',
  '/misclientes - Ver tus clientes asignados',
  '',
  'Tambien puedes usar el menu visible del chat.'
].join('\n');

const showMainMenu = async (ctx) => {
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
  await ctx.reply(HELP_TEXT, mainKeyboard);
};

const whoAmICommand = async (ctx) => {
  await ctx.reply([
    'Datos de este chat:',
    `telegramChatId: ${ctx.chat?.id || 'No disponible'}`,
    `telegramUsername: ${ctx.from?.username || 'No disponible'}`,
    `telegramFirstName: ${ctx.from?.first_name || 'No disponible'}`
  ].join('\n'));
};

const vincularCommand = async (ctx) => {
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
  bot.hears('Ver mis clientes', misClientesCommand);
  bot.hears('Ayuda', helpCommand);
  bot.hears('Crear cliente', pendingFeatureCommand);
  bot.hears('Crear prestamo', pendingFeatureCommand);
  bot.hears('Registrar pago', pendingFeatureCommand);
};

module.exports = {
  registerCommands
};
