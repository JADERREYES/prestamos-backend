const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Pago = require('../models/Pago');
const Prestamo = require('../models/Prestamo');
const Tenant = require('../models/Tenant');
const Admin = require('../models/Admin');
const NotificacionPago = require('../models/NotificacionPago');

// Middleware para verificar token
const verificarToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'tu_secreto_temporal'
    );

    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// ============================================
// RUTAS PARA COBRADORES (PAGOS DE PRÉSTAMOS)
// ============================================

// Registrar un pago de préstamo (desde cobrador)
router.post('/', verificarToken, async (req, res) => {
  try {
    const { prestamoId, monto, metodoPago, referencia } = req.body;
    const tenantId = req.usuario.tenantId;

    console.log('💰 Registrando pago de préstamo:', {
      prestamoId,
      monto,
      metodoPago
    });

    if (!prestamoId || !monto) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    if (prestamo.tenantId !== tenantId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (prestamo.estado === 'pagado') {
      return res.status(400).json({ error: 'Este préstamo ya está pagado' });
    }

    const nuevoTotalPagado = (prestamo.totalPagado || 0) + Number(monto);

    let nuevoEstado = prestamo.estado;
    if (nuevoTotalPagado >= prestamo.totalAPagar) {
      nuevoEstado = 'pagado';
    }

    await Prestamo.findByIdAndUpdate(prestamoId, {
      totalPagado: nuevoTotalPagado,
      estado: nuevoEstado,
      ultimoPago: new Date()
    });

    const nuevoPago = new Pago({
      prestamoId,
      clienteId: prestamo.clienteId,
      monto,
      metodoPago: metodoPago || 'efectivo',
      referencia: referencia || '',
      fecha: new Date(),
      registradoPor: req.usuario.id,
      registradoPorTipo: req.usuario.rol,
      tenantId
    });

    await nuevoPago.save();

    console.log('✅ Pago registrado exitosamente');

    res.json({
      mensaje: 'Pago registrado exitosamente',
      pago: nuevoPago,
      prestamoActualizado: {
        totalPagado: nuevoTotalPagado,
        estado: nuevoEstado
      }
    });
  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de pagos de un préstamo
router.get('/prestamo/:prestamoId', verificarToken, async (req, res) => {
  try {
    const { prestamoId } = req.params;
    const tenantId = req.usuario.tenantId;

    const pagos = await Pago.find({ prestamoId, tenantId })
      .sort({ fecha: -1 })
      .populate('registradoPor', 'nombre email');

    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener pagos del día
router.get('/hoy', verificarToken, async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pagos = await Pago.find({
      tenantId,
      fecha: { $gte: hoy, $lt: manana }
    })
      .populate('prestamoId clienteId')
      .sort({ fecha: -1 });

    const total = pagos.reduce((sum, p) => sum + p.monto, 0);

    res.json({ pagos, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS PARA ADMINISTRADORES (PAGOS DE EMPRESA)
// ============================================

// Registrar un pago de empresa (desde el admin de oficina)
router.post('/registrar', verificarToken, async (req, res) => {
  try {
    const { tenantId, monto, mes, año, fechaVencimiento } = req.body;

    if (!tenantId || !mes || !año) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const pagoExistente = await Pago.findOne({ tenantId, año, mes });
    if (pagoExistente) {
      return res.status(400).json({
        error: 'Ya hay un pago registrado para este mes'
      });
    }

    const nuevoPago = new Pago({
      tenantId,
      tenantNombre: tenant.nombre,
      monto: monto || 350000,
      mes,
      año,
      fechaVencimiento: fechaVencimiento || new Date(),
      fechaPago: new Date(),
      estado: 'pagado',
      registradoPor: req.usuario.id,
      registradoPorTipo: 'admin'
    });

    await nuevoPago.save();

    const io = req.app.get('io');
    if (io) {
      io.to('superadmin-room').emit('nueva-notificacion', {
        type: 'pago',
        empresa: tenant.nombre,
        mensaje: `${tenant.nombre} ha realizado un pago de $${(
          monto || 350000
        ).toLocaleString()}`,
        fecha: new Date()
      });
    }

    res.json({
      mensaje: 'Pago registrado exitosamente',
      pago: nuevoPago
    });
  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de pagos de una empresa
router.get('/historial/:tenantId', verificarToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const pagos = await Pago.find({ tenantId }).sort({ fechaPago: -1 });
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener empresas con pagos pendientes (para super admin)
router.get('/pendientes', verificarToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.usuario.id);
    if (!admin || admin.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const hoy = new Date();
    const empresas = await Tenant.find({ estado: true });
    const pendientes = [];

    for (const empresa of empresas) {
      const fechaCreacion = empresa.fechaCreacion
        ? new Date(empresa.fechaCreacion)
        : empresa.createdAt
        ? new Date(empresa.createdAt)
        : new Date();

      const ultimoPago = await Pago.findOne({
        tenantId: empresa.tenantId,
        estado: 'pagado'
      }).sort({ fechaPago: -1 });

      let ultimaFechaPago = fechaCreacion;

      if (ultimoPago && ultimoPago.fechaPago) {
        ultimaFechaPago = new Date(ultimoPago.fechaPago);
      }

      const proximoVencimiento = new Date(ultimaFechaPago);
      proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);

      if (proximoVencimiento <= hoy) {
        const diasAtraso = Math.floor(
          (hoy - proximoVencimiento) / (1000 * 60 * 60 * 24)
        );

        pendientes.push({
          id: empresa._id,
          nombre: empresa.nombre,
          tenantId: empresa.tenantId,
          fechaVencimiento: proximoVencimiento.toISOString().split('T')[0],
          diasAtraso,
          montoPendiente: 350000,
          contacto: `admin@${empresa.tenantId}.com`,
          estado:
            diasAtraso > 30
              ? 'critico'
              : diasAtraso > 15
              ? 'alerta'
              : 'seguimiento'
        });
      }
    }

    res.json(pendientes);
  } catch (error) {
    console.error('Error obteniendo pagos pendientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener notificaciones enviadas para la oficina actual
router.get('/mis-notificaciones', verificarToken, async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant no definido' });
    }

    const notificaciones = await NotificacionPago.find({ tenantId })
      .sort({ fechaEnvio: -1 })
      .limit(50);

    res.json(notificaciones);
  } catch (error) {
    console.error('Error obteniendo mis notificaciones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar notificación como leída
router.patch('/mis-notificaciones/:id/leida', verificarToken, async (req, res) => {
  try {
    const tenantId = req.usuario.tenantId;
    const { id } = req.params;

    const notificacion = await NotificacionPago.findOneAndUpdate(
      { _id: id, tenantId },
      { leida: true },
      { new: true }
    );

    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({
      mensaje: 'Notificación marcada como leída',
      notificacion
    });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar recordatorio normal (super admin -> admin de oficina)
router.post('/recordatorio', verificarToken, async (req, res) => {
  try {
    const { tenantId, empresa, monto, diasAtraso, fechaVencimiento, mensajePersonalizado } = req.body;

    const admin = await Admin.findById(req.usuario.id);
    if (!admin || admin.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const mensajeFinal =
      mensajePersonalizado ||
      `⚠️ RECORDATORIO: Tienes un pago pendiente de $${Number(
        monto || 0
      ).toLocaleString()} con ${diasAtraso || 0} días de atraso.`;

    const nuevaNotificacion = new NotificacionPago({
      tenantId,
      empresa: empresa || tenant.nombre,
      tipo: 'normal',
      mensaje: mensajeFinal,
      fechaVencimiento,
      diasAtraso: diasAtraso || 0,
      monto: monto || 0,
      enviada: true,
      leida: false,
      fechaEnvio: new Date()
    });

    await nuevaNotificacion.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant-${tenantId}`).emit('recibido-recordatorio', {
        _id: nuevaNotificacion._id,
        type: 'recordatorio-pago',
        empresa: empresa || tenant.nombre,
        mensaje: mensajeFinal,
        fechaVencimiento,
        diasAtraso,
        monto,
        fecha: new Date()
      });
    }

    res.json({
      mensaje: 'Recordatorio enviado correctamente',
      notificacion: nuevaNotificacion
    });
  } catch (error) {
    console.error('Error enviando recordatorio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar recordatorio mensual (super admin -> admin de oficina)
router.post('/recordatorio-mensual', verificarToken, async (req, res) => {
  try {
    const { tenantId, empresa, monto, diasAtraso, fechaVencimiento, mensajePersonalizado } = req.body;

    const admin = await Admin.findById(req.usuario.id);
    if (!admin || admin.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }

    const mensajeFinal =
      mensajePersonalizado ||
      `⚠️ RECORDATORIO MENSUAL: El pago de la mensualidad correspondiente al mes de ${fechaVencimiento} está pendiente. Monto: $${Number(
        monto || 0
      ).toLocaleString()}. Días de atraso: ${diasAtraso || 0}`;

    const nuevaNotificacion = new NotificacionPago({
      tenantId,
      empresa: empresa || tenant.nombre,
      tipo: 'mensual',
      mensaje: mensajeFinal,
      fechaVencimiento,
      diasAtraso: diasAtraso || 0,
      monto: monto || 0,
      enviada: true,
      leida: false,
      fechaEnvio: new Date()
    });

    await nuevaNotificacion.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant-${tenantId}`).emit('recibido-recordatorio-mensual', {
        _id: nuevaNotificacion._id,
        type: 'recordatorio-pago-mensual',
        empresa: empresa || tenant.nombre,
        mensaje: mensajeFinal,
        fechaVencimiento,
        diasAtraso,
        monto,
        fecha: new Date()
      });
    }

    console.log(`🔔 Recordatorio mensual enviado a ${tenant.nombre} (tenant: ${tenantId})`);

    res.json({
      mensaje: 'Recordatorio mensual enviado correctamente',
      notificacion: nuevaNotificacion
    });
  } catch (error) {
    console.error('Error enviando recordatorio mensual:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;