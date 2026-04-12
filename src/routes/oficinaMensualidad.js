const express = require('express');
const router = express.Router();

const MensualidadOficina = require('../models/MensualidadOficina');
const Tenant = require('../models/Tenant');
const {
  calcularEstadoMensualidad,
  crearMensualidadBase,
  getPeriodoActual,
  normalizarTenantId,
  parsePeriodo,
  serializarMensualidad
} = require('../utils/mensualidadOficina');

const syncEstadoMensualidad = async (mensualidad) => {
  const calculado = calcularEstadoMensualidad(mensualidad);

  if (mensualidad.estado !== calculado.estado) {
    mensualidad.estado = calculado.estado;
    await mensualidad.save();
  }

  return mensualidad;
};

router.get('/estado', async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant no definido' });
    }

    const tenantId = normalizarTenantId(req.tenantId);
    const tenant = await Tenant.findOne({ tenantId });

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = req.query.periodo || getPeriodoActual();
    parsePeriodo(periodo);

    let mensualidad = await MensualidadOficina.findOne({ tenantId, periodo });

    if (mensualidad) {
      mensualidad = await syncEstadoMensualidad(mensualidad);
    }

    res.json({
      periodo,
      mensualidad: mensualidad
        ? serializarMensualidad(mensualidad, tenant)
        : serializarMensualidad(crearMensualidadBase(tenant, periodo), tenant)
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

module.exports = router;
