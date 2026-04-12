const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Admin = require('../models/Admin');
const MensualidadOficina = require('../models/MensualidadOficina');
const NotificacionOficina = require('../models/NotificacionOficina');
const Tenant = require('../models/Tenant');
const { verifyToken } = require('../utils/jwt');
const {
  calcularEstadoMensualidad,
  createHttpError,
  crearMensualidadBase,
  getFechaVencimiento,
  getMontoMensualidad,
  getPeriodoActual,
  handleMongoError,
  parsePeriodo,
  serializarMensualidad,
  validarLongitud,
  validarTenantId
} = require('../utils/mensualidadOficina');

const isSuperadminRole = (rol) => rol === 'superadmin' || rol === 'superadministrador';
const MAX_TITULO = 120;
const MAX_MENSAJE = 1000;
const MAX_REFERENCIA = 80;
const MAX_NOTAS = 500;

const sendError = (res, error) => {
  const normalized = handleMongoError(error);
  const status = normalized.status || (normalized.name === 'ValidationError' ? 400 : 500);
  return res.status(status).json({ error: normalized.message });
};

const requireSuperadmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = verifyToken(token);

    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(401).json({ error: 'Token invalido' });
    }

    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (!isSuperadminRole(admin.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    req.user = admin;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token invalido' });
    }

    return sendError(res, error);
  }
};

const getPeriodoRequest = (req) => {
  const periodo = String(req.query.periodo || req.body.periodo || getPeriodoActual()).trim();
  parsePeriodo(periodo);
  return periodo;
};

const findTenantByTenantId = async (tenantIdParam) => {
  const tenantId = validarTenantId(tenantIdParam);
  return Tenant.findOne({ tenantId });
};

const buildMensualidadPayload = (tenant, periodo, body, userId) => {
  const tenantId = validarTenantId(tenant.tenantId);
  const monto = body.monto !== undefined ? Number(body.monto) : getMontoMensualidad(tenant);
  const fechaPago = body.fechaPago ? new Date(body.fechaPago) : new Date();
  const ahora = new Date();

  if (!Number.isFinite(monto) || monto < 0) {
    throw createHttpError(400, 'Monto invalido');
  }

  if (Number.isNaN(fechaPago.getTime())) {
    throw createHttpError(400, 'Fecha de pago invalida');
  }

  if (fechaPago > ahora) {
    throw createHttpError(400, 'La fecha de pago no puede ser futura');
  }

  return {
    tenantId,
    periodo,
    monto,
    fechaVencimiento: getFechaVencimiento(tenant, periodo),
    fechaPago,
    estado: 'pagado',
    metodoPago: body.metodoPago || 'efectivo',
    referencia: validarLongitud(body.referencia, 'referencia', MAX_REFERENCIA),
    notas: validarLongitud(body.notas, 'notas', MAX_NOTAS),
    registradoPor: userId
  };
};

router.use(requireSuperadmin);

router.get('/morosas', async (req, res) => {
  try {
    const periodo = getPeriodoRequest(req);
    const tenants = await Tenant.find({ estado: true }).sort({ nombre: 1 }).lean();
    const tenantIds = tenants.map((tenant) => validarTenantId(tenant.tenantId));
    const tenantById = new Map(tenants.map((tenant) => [validarTenantId(tenant.tenantId), tenant]));

    const mensualidades = await MensualidadOficina.find({
      periodo,
      tenantId: { $in: tenantIds }
    }).lean();

    const morosas = mensualidades
      .map((mensualidad) => {
        const tenant = tenantById.get(mensualidad.tenantId);
        return tenant ? serializarMensualidad(mensualidad, tenant) : null;
      })
      .filter((mensualidad) => mensualidad && mensualidad.estado === 'vencido');

    res.json({
      periodo,
      total: morosas.length,
      mensualidades: morosas
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:tenantId', async (req, res) => {
  try {
    const tenant = await findTenantByTenantId(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = getPeriodoRequest(req);
    const tenantId = validarTenantId(tenant.tenantId);
    const mensualidadActual = await MensualidadOficina.findOne({ tenantId, periodo }).lean();
    const historial = await MensualidadOficina.find({ tenantId })
      .sort({ periodo: -1 })
      .limit(24)
      .lean();

    res.json({
      tenant: {
        _id: tenant._id,
        nombre: tenant.nombre,
        tenantId: tenant.tenantId
      },
      periodo,
      estadoActual: mensualidadActual
        ? serializarMensualidad(mensualidadActual, tenant)
        : {
          ...serializarMensualidad(crearMensualidadBase(tenant, periodo), tenant),
          persistida: false
        },
      historial: historial.map((mensualidad) => serializarMensualidad(mensualidad, tenant))
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:tenantId/registrar-pago', async (req, res) => {
  try {
    const tenant = await findTenantByTenantId(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = getPeriodoRequest(req);
    const tenantId = validarTenantId(tenant.tenantId);
    const existente = await MensualidadOficina.findOne({ tenantId, periodo });

    if (existente?.estado === 'pagado' || existente?.fechaPago) {
      return res.status(409).json({ error: 'La mensualidad de este periodo ya esta pagada' });
    }

    const payload = buildMensualidadPayload(tenant, periodo, req.body, req.user._id);
    const mensualidad = existente
      ? await MensualidadOficina.findOneAndUpdate(
        { tenantId, periodo, fechaPago: null },
        payload,
        { new: true, runValidators: true }
      )
      : await MensualidadOficina.create(payload);

    if (!mensualidad) {
      return res.status(409).json({ error: 'La mensualidad ya fue modificada' });
    }

    res.status(existente ? 200 : 201).json({
      mensaje: 'Mensualidad registrada como pagada',
      mensualidad: serializarMensualidad(mensualidad, tenant)
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/:tenantId/notificar', async (req, res) => {
  try {
    const tenant = await findTenantByTenantId(req.params.tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Oficina no encontrada' });
    }

    const periodo = getPeriodoRequest(req);
    const tenantId = validarTenantId(tenant.tenantId);
    let mensualidad = await MensualidadOficina.findOne({ tenantId, periodo });

    if (!mensualidad) {
      mensualidad = await MensualidadOficina.create(crearMensualidadBase(tenant, periodo));
    }

    const estado = serializarMensualidad(mensualidad, tenant);

    if (estado.estado !== 'vencido') {
      return res.status(409).json({
        error: 'Solo se puede notificar una mensualidad vencida',
        estado: estado.estado
      });
    }

    const titulo = validarLongitud(req.body.titulo || 'Mensualidad vencida', 'titulo', MAX_TITULO);
    const mensaje = validarLongitud(
      req.body.mensaje || `La mensualidad del periodo ${periodo} esta vencida. Dias de mora: ${estado.diasMora}.`,
      'mensaje',
      MAX_MENSAJE
    );

    const notificacionExistente = await NotificacionOficina.findOne({
      tenantId,
      periodo,
      tipo: 'mensualidad_morosa',
      leida: false
    });

    if (notificacionExistente) {
      return res.status(409).json({ error: 'Ya existe una notificacion activa para esta mensualidad' });
    }

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

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant-${tenantId}`).emit('notificacion-oficina', {
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
      });
    }

    res.status(201).json({
      mensaje: 'Notificacion interna enviada correctamente',
      notificacion
    });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
