const express = require('express');
const router = express.Router();

const Admin = require('../models/Admin');
const MensualidadOficina = require('../models/MensualidadOficina');
const NotificacionOficina = require('../models/NotificacionOficina');
const Tenant = require('../models/Tenant');
const { verifyToken } = require('../utils/jwt');
const {
  calcularEstadoMensualidad,
  crearMensualidadBase,
  getFechaVencimiento,
  getMontoMensualidad,
  getPeriodoActual,
  normalizarTenantId,
  parsePeriodo,
  serializarMensualidad
} = require('../utils/mensualidadOficina');

const isSuperadminRole = (rol) => rol === 'superadmin' || rol === 'superadministrador';

const requireSuperadmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = verifyToken(token);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !isSuperadminRole(admin.rol)) {
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

const getPeriodoRequest = (req) => {
  const periodo = req.query.periodo || req.body.periodo || getPeriodoActual();
  parsePeriodo(periodo);
  return periodo;
};

const findTenantByTenantId = async (tenantId) => {
  const tenantIdNormalizado = normalizarTenantId(tenantId);
  return Tenant.findOne({ tenantId: tenantIdNormalizado });
};

const syncEstadoMensualidad = async (mensualidad) => {
  const calculado = calcularEstadoMensualidad(mensualidad);

  if (mensualidad.estado !== calculado.estado) {
    mensualidad.estado = calculado.estado;
    await mensualidad.save();
  }

  return mensualidad;
};

router.use(requireSuperadmin);

router.get('/morosas', async (req, res) => {
  try {
    const periodo = req.query.periodo || getPeriodoActual();
    parsePeriodo(periodo);

    const tenants = await Tenant.find({ estado: true }).sort({ nombre: 1 });
    const morosas = [];

    for (const tenant of tenants) {
      const base = crearMensualidadBase(tenant, periodo);
      let mensualidad = await MensualidadOficina.findOne({
        tenantId: base.tenantId,
        periodo
      });

      if (mensualidad) {
        mensualidad = await syncEstadoMensualidad(mensualidad);
      }

      const estado = serializarMensualidad(mensualidad || base, tenant);

      if (estado.estado === 'vencido') {
        morosas.push(estado);
      }
    }

    res.json({
      periodo,
      total: morosas.length,
      mensualidades: morosas
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/:tenantId', async (req, res) => {
  try {
    const tenant = await findTenantByTenantId(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = req.query.periodo || getPeriodoActual();
    parsePeriodo(periodo);

    const tenantId = normalizarTenantId(tenant.tenantId);
    const mensualidadActual = await MensualidadOficina.findOne({ tenantId, periodo });
    const historial = await MensualidadOficina.find({ tenantId })
      .sort({ periodo: -1 })
      .limit(24);

    for (const mensualidad of historial) {
      await syncEstadoMensualidad(mensualidad);
    }

    const estadoActual = mensualidadActual
      ? serializarMensualidad(await syncEstadoMensualidad(mensualidadActual), tenant)
      : serializarMensualidad(crearMensualidadBase(tenant, periodo), tenant);

    res.json({
      tenant: {
        _id: tenant._id,
        nombre: tenant.nombre,
        tenantId: tenant.tenantId
      },
      periodo,
      estadoActual,
      historial: historial.map((mensualidad) => serializarMensualidad(mensualidad, tenant))
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:tenantId/registrar-pago', async (req, res) => {
  try {
    const tenant = await findTenantByTenantId(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = getPeriodoRequest(req);
    const tenantId = normalizarTenantId(tenant.tenantId);
    const existente = await MensualidadOficina.findOne({ tenantId, periodo });

    if (existente?.estado === 'pagado' || existente?.fechaPago) {
      return res.status(400).json({ error: 'La mensualidad de este periodo ya esta pagada' });
    }

    const monto = req.body.monto !== undefined
      ? Number(req.body.monto)
      : getMontoMensualidad(tenant);

    if (!Number.isFinite(monto) || monto < 0) {
      return res.status(400).json({ error: 'Monto invalido' });
    }

    const fechaPago = req.body.fechaPago ? new Date(req.body.fechaPago) : new Date();

    if (Number.isNaN(fechaPago.getTime())) {
      return res.status(400).json({ error: 'Fecha de pago invalida' });
    }

    const payload = {
      tenantId,
      periodo,
      monto,
      fechaVencimiento: getFechaVencimiento(tenant, periodo),
      fechaPago,
      estado: 'pagado',
      metodoPago: req.body.metodoPago || 'efectivo',
      referencia: req.body.referencia || '',
      notas: req.body.notas || '',
      registradoPor: req.user._id
    };

    const mensualidad = existente
      ? await MensualidadOficina.findOneAndUpdate({ tenantId, periodo }, payload, { new: true, runValidators: true })
      : await MensualidadOficina.create(payload);

    res.status(existente ? 200 : 201).json({
      mensaje: 'Pago de mensualidad registrado correctamente',
      mensualidad: serializarMensualidad(mensualidad, tenant)
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:tenantId/notificar', async (req, res) => {
  try {
    const tenant = await findTenantByTenantId(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = getPeriodoRequest(req);
    const tenantId = normalizarTenantId(tenant.tenantId);
    let mensualidad = await MensualidadOficina.findOne({ tenantId, periodo });

    if (!mensualidad) {
      mensualidad = new MensualidadOficina(crearMensualidadBase(tenant, periodo));
      await mensualidad.save();
      await syncEstadoMensualidad(mensualidad);
    } else {
      mensualidad = await syncEstadoMensualidad(mensualidad);
    }

    const estado = serializarMensualidad(mensualidad, tenant);

    if (estado.estado !== 'vencido') {
      return res.status(400).json({
        error: 'Solo se puede notificar una mensualidad vencida',
        estado: estado.estado
      });
    }

    const titulo = req.body.titulo || 'Mensualidad vencida';
    const mensaje = req.body.mensaje || `La mensualidad del periodo ${periodo} esta vencida. Dias de mora: ${estado.diasMora}.`;

    const notificacion = await NotificacionOficina.create({
      tenantId,
      tipo: 'mensualidad_morosa',
      titulo,
      mensaje,
      enviadaPor: req.user._id,
      mensualidadId: mensualidad._id,
      periodo,
      metadata: {
        monto: mensualidad.monto,
        diasMora: estado.diasMora,
        fechaVencimiento: mensualidad.fechaVencimiento
      }
    });

    const payloadSocket = {
      _id: notificacion._id,
      id: notificacion._id,
      tenantId,
      tipo: notificacion.tipo,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      leida: notificacion.leida,
      periodo: notificacion.periodo,
      metadata: notificacion.metadata,
      createdAt: notificacion.createdAt
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant-${tenantId}`).emit('notificacion-oficina', payloadSocket);
    }

    res.status(201).json({
      mensaje: 'Notificacion interna enviada correctamente',
      notificacion
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

module.exports = router;
