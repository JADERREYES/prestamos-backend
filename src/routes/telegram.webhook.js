const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { bot } = require('../telegram/bot');
const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');
const { verifyToken } = require('../utils/jwt');
const { generarCodigoVinculacion } = require('../services/telegramCobrador.service');

const isSuperadminRole = (rol) => rol === 'superadmin' || rol === 'superadministrador';

const requireAdminOrSuperadmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = verifyToken(token);
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (!['admin', 'superadmin', 'superadministrador'].includes(admin.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    req.user = admin;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token invalido' });
    }

    return res.status(500).json({ error: error.message });
  }
};

const getCobradorAutorizado = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'cobradorId invalido' });
    return null;
  }

  const cobrador = await Cobrador.findById(id);

  if (!cobrador) {
    res.status(404).json({ error: 'Cobrador no encontrado' });
    return null;
  }

  if (!isSuperadminRole(req.user.rol) && String(cobrador.tenantId) !== String(req.user.tenantId)) {
    res.status(403).json({ error: 'No autorizado para este cobrador' });
    return null;
  }

  return cobrador;
};

router.post('/vinculacion/cobradores/:id/generar-codigo', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const cobrador = await getCobradorAutorizado(req, res);
    if (!cobrador) return;

    const linkCode = await generarCodigoVinculacion({
      cobrador,
      creadoPor: req.user._id,
      creadoPorRol: req.user.rol
    });

    res.status(201).json({
      codigo: linkCode.codigo,
      expiraEn: linkCode.expiraEn,
      cobradorId: cobrador._id,
      tenantId: cobrador.tenantId
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Conflicto generando codigo de vinculacion' });
    }

    return res.status(500).json({ error: error.message });
  }
});

router.get('/vinculacion/cobradores/:id/estado', requireAdminOrSuperadmin, async (req, res) => {
  try {
    const cobrador = await getCobradorAutorizado(req, res);
    if (!cobrador) return;

    res.json({
      cobradorId: cobrador._id,
      tenantId: cobrador.tenantId,
      telegramActivo: Boolean(cobrador.telegramActivo),
      telegramChatId: cobrador.telegramChatId || null,
      telegramUsername: cobrador.telegramUsername || '',
      telegramFirstName: cobrador.telegramFirstName || ''
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

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
