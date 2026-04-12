const express = require('express');
const router = express.Router();
const { bot } = require('../telegram/bot');

router.post('/webhook/:secret', async (req, res) => {
  try {
    if (!bot) {
      return res.status(503).json({ error: 'Telegram bot no configurado' });
    }

    if (!process.env.TELEGRAM_WEBHOOK_SECRET || req.params.secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Webhook no autorizado' });
    }

    await bot.handleUpdate(req.body);
    return res.sendStatus(200);
  } catch (error) {
    console.error('Error procesando webhook Telegram:', error.message);
    return res.status(500).json({ error: 'Error procesando webhook Telegram' });
  }
});

module.exports = router;
