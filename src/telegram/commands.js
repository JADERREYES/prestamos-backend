const { mainKeyboard } = require('./keyboards');
const { replyLoginRequired } = require('./handlers');
const {
  autenticarCobradorTelegram,
  obtenerClientesDelCobradorTelegram
} = require('../services/telegramCobrador.service');

const HELP_TEXT = [
  'Comandos disponibles:',
  '/start - Iniciar el bot',
  '/help - Ver ayuda',
  '/login correo contrasena - Asociar este chat con tu usuario cobrador',
  '/misclientes - Ver tus clientes asignados'
].join('\n');

const startCommand = async (ctx) => {
  await ctx.reply(
    'Bienvenido. Este bot consulta datos desde el backend de prestamos. Autenticate con /login correo contrasena.',
    mainKeyboard
  );
};

const helpCommand = async (ctx) => {
  await ctx.reply(HELP_TEXT, mainKeyboard);
};

const loginCommand = async (ctx) => {
  const text = ctx.message?.text || '';
  const [, email, ...passwordParts] = text.trim().split(/\s+/);
  const password = passwordParts.join(' ');

  if (!email || !password) {
    await ctx.reply('Uso correcto: /login correo contrasena');
    return;
  }

  const cobrador = await autenticarCobradorTelegram({
    email,
    password,
    chatId: ctx.chat?.id,
    from: ctx.from
  });

  await ctx.reply(`Autenticacion correcta. Chat asociado a ${cobrador.nombre}.`, mainKeyboard);
};

const misClientesCommand = async (ctx) => {
  const { cobrador, clientes } = await obtenerClientesDelCobradorTelegram(ctx.chat?.id);

  if (!cobrador) {
    await replyLoginRequired(ctx);
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

const registerCommands = (bot) => {
  bot.start(startCommand);
  bot.help(helpCommand);
  bot.command('login', loginCommand);
  bot.command('misclientes', misClientesCommand);
};

module.exports = {
  registerCommands
};
