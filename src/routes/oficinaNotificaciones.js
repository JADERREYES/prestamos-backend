const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const NotificacionOficina = require('../models/NotificacionOficina');
const { validarObjectId, validarTenantId } = require('../utils/mensualidadOficina');

router.get('/', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant no definido' });
    }

    const tenantId = validarTenantId(req.tenantId);
    const notificaciones = await NotificacionOficina.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      total: notificaciones.length,
      noLeidas: notificaciones.filter((notificacion) => !notificacion.leida).length,
      notificaciones
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/leida', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant no definido' });
    }

    validarObjectId(mongoose, req.params.id, 'notificacionId');

    const tenantId = validarTenantId(req.tenantId);
    const notificacion = await NotificacionOficina.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { leida: true, fechaLeida: new Date() },
      { new: true }
    );

    if (!notificacion) {
      return res.status(404).json({ error: 'Notificacion no encontrada' });
    }

    res.json({
      mensaje: 'Notificacion marcada como leida',
      notificacion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
