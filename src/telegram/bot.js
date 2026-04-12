const { Telegraf } = require('telegraf');
const { registerCommands } = require('./commands');
const { handleTelegramError } = require('./handlers');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = token ? new Telegraf(token) : null;

if (bot) {
  registerCommands(bot);

  bot.catch(async (error, ctx) => {
    await handleTelegramError(ctx, error);
  });
}

const getWebhookPath = () => `/api/telegram/webhook/${process.env.TELEGRAM_WEBHOOK_SECRET}`;

const getWebhookUrl = () => {
  const baseUrl = String(process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl || !process.env.TELEGRAM_WEBHOOK_SECRET) return null;
  return `${baseUrl}${getWebhookPath()}`;
};

const setupTelegramWebhook = async () => {
  if (!bot) {
    console.log('Telegram webhook no configurado: falta TELEGRAM_BOT_TOKEN');
    return;
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    console.log('Telegram webhook no configurado: falta APP_BASE_URL o TELEGRAM_WEBHOOK_SECRET');
    return;
  }

  if (!webhookUrl.startsWith('https://')) {
    console.log('Telegram webhook no configurado: APP_BASE_URL debe ser HTTPS en produccion');
    return;
  }

  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log('Telegram webhook configurado:', webhookUrl);
  } catch (error) {
    console.error('No se pudo configurar el webhook de Telegram:', error.message);
  }
};

module.exports = {
  bot,
  getWebhookUrl,
  setupTelegramWebhook
};
