const express = require('express');
const router = express.Router();

const MensualidadOficina = require('../models/MensualidadOficina');
const Tenant = require('../models/Tenant');
const {
  crearMensualidadBase,
  getPeriodoActual,
  parsePeriodo,
  serializarMensualidad,
  validarTenantId
} = require('../utils/mensualidadOficina');

router.get('/estado', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant no definido' });
    }

    const tenantId = validarTenantId(req.tenantId);
    const tenant = await Tenant.findOne({ tenantId });

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = req.query.periodo || getPeriodoActual();
    parsePeriodo(periodo);

    const mensualidad = await MensualidadOficina.findOne({ tenantId, periodo }).lean();

    res.json({
      periodo,
      mensualidad: mensualidad
        ? serializarMensualidad(mensualidad, tenant)
        : {
          ...serializarMensualidad(crearMensualidadBase(tenant, periodo), tenant),
          persistida: false
        }
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

module.exports = router;
