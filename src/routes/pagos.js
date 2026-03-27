const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Pago = require('../models/Pago');
const Prestamo = require('../models/Prestamo');
const Tenant = require('../models/Tenant');
const Admin = require('../models/Admin');

// Middleware para verificar token
const verificarToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_temporal');
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
    
    console.log('💰 Registrando pago de préstamo:', { prestamoId, monto, metodoPago });
    
    if (!prestamoId || !monto) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    
    // Buscar el préstamo
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    // Verificar que el préstamo pertenece al tenant
    if (prestamo.tenantId !== tenantId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    // Verificar que el préstamo no esté pagado
    if (prestamo.estado === 'pagado') {
      return res.status(400).json({ error: 'Este préstamo ya está pagado' });
    }
    
    // Calcular nuevo total pagado
    const nuevoTotalPagado = (prestamo.totalPagado || 0) + monto;
    
    // Actualizar estado del préstamo
    let nuevoEstado = prestamo.estado;
    if (nuevoTotalPagado >= prestamo.totalAPagar) {
      nuevoEstado = 'pagado';
    }
    
    // Actualizar préstamo
    await Prestamo.findByIdAndUpdate(prestamoId, {
      totalPagado: nuevoTotalPagado,
      estado: nuevoEstado,
      ultimoPago: new Date()
    });
    
    // Registrar pago
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
    }).populate('prestamoId clienteId').sort({ fecha: -1 });
    
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
    
    // Verificar que la empresa existe
    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    
    // Verificar que no haya un pago registrado para este mes
    const pagoExistente = await Pago.findOne({ tenantId, año, mes });
    if (pagoExistente) {
      return res.status(400).json({ error: 'Ya hay un pago registrado para este mes' });
    }
    
    // Crear registro de pago
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
    
    // Notificar al superadmin vía WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to('superadmin-room').emit('nueva-notificacion', {
        type: 'pago',
        empresa: tenant.nombre,
        mensaje: `${tenant.nombre} ha realizado un pago de $${(monto || 350000).toLocaleString()}`,
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

// Obtener empresas con pagos pendientes (para Super Admin)
router.get('/pendientes', verificarToken, async (req, res) => {
  try {
    // Verificar que sea superadmin
    const admin = await Admin.findById(req.usuario.id);
    if (admin.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const hoy = new Date();
    const empresas = await Tenant.find({ estado: true });
    const pendientes = [];
    
    for (const empresa of empresas) {
      const fechaCreacion = new Date(empresa.fechaCreacion);
      const ultimoPago = await Pago.findOne({ tenantId: empresa.tenantId }).sort({ fechaPago: -1 });
      
      let ultimaFechaPago = fechaCreacion;
      if (ultimoPago) {
        ultimaFechaPago = new Date(ultimoPago.fechaPago);
      }
      
      // Calcular próxima fecha de vencimiento (mensual)
      const proximoVencimiento = new Date(ultimaFechaPago);
      proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);
      
      if (proximoVencimiento <= hoy) {
        const diasAtraso = Math.floor((hoy - proximoVencimiento) / (1000 * 60 * 60 * 24));
        pendientes.push({
          id: empresa._id,
          nombre: empresa.nombre,
          tenantId: empresa.tenantId,
          fechaVencimiento: proximoVencimiento.toISOString().split('T')[0],
          diasAtraso,
          montoPendiente: 350000,
          contacto: `admin@${empresa.tenantId}.com`,
          estado: empresa.estado
        });
      }
    }
    
    res.json(pendientes);
    
  } catch (error) {
    console.error('Error obteniendo pagos pendientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar recordatorio (desde Super Admin)
router.post('/recordatorio', verificarToken, async (req, res) => {
  try {
    const { tenantId, empresa, monto, diasAtraso, fechaVencimiento } = req.body;
    
    // Verificar que sea superadmin
    const admin = await Admin.findById(req.usuario.id);
    if (admin.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    // Obtener el socket.io del servidor
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant-${tenantId}`).emit('recibido-recordatorio', {
        type: 'recordatorio-pago',
        empresa,
        mensaje: `⚠️ RECORDATORIO: Tienes un pago pendiente de $${monto.toLocaleString()} con ${diasAtraso} días de atraso.`,
        fechaVencimiento,
        diasAtraso,
        monto,
        fecha: new Date()
      });
    }
    
    res.json({ mensaje: 'Recordatorio enviado correctamente' });
    
  } catch (error) {
    console.error('Error enviando recordatorio:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NOTIFICACIÓN DE PAGO MENSUAL - SUPER ADMIN A ADMIN DE OFICINA
// ============================================

// Enviar recordatorio de pago mensual (Super Admin -> Admin de oficina)
router.post('/recordatorio-mensual', verificarToken, async (req, res) => {
  try {
    const { tenantId, empresa, monto, diasAtraso, fechaVencimiento } = req.body;
    
    // Verificar que sea superadmin
    const admin = await Admin.findById(req.usuario.id);
    if (admin.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    // Verificar que la empresa existe
    const tenant = await Tenant.findOne({ tenantId });
    if (!tenant) {
      return res.status(404).json({ error: 'Empresa no encontrada' });
    }
    
    // Obtener el socket.io del servidor
    const io = req.app.get('io');
    if (io) {
      // Enviar notificación al admin de la oficina
      io.to(`tenant-${tenantId}`).emit('recibido-recordatorio-mensual', {
        type: 'recordatorio-pago-mensual',
        empresa: empresa || tenant.nombre,
        mensaje: `⚠️ RECORDATORIO MENSUAL: El pago de la mensualidad correspondiente al mes de ${fechaVencimiento} está pendiente. Monto: $${monto.toLocaleString()}. Días de atraso: ${diasAtraso}`,
        fechaVencimiento,
        diasAtraso,
        monto,
        fecha: new Date()
      });
      
      console.log(`🔔 Recordatorio mensual enviado a ${tenant.nombre} (tenant: ${tenantId})`);
    }
    
    res.json({ 
      mensaje: 'Recordatorio mensual enviado correctamente',
      enviadoA: tenant.nombre
    });
    
  } catch (error) {
    console.error('Error enviando recordatorio mensual:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener empresas con pagos mensuales pendientes
router.get('/mensuales-pendientes', verificarToken, async (req, res) => {
  try {
    // Verificar que sea superadmin
    const admin = await Admin.findById(req.usuario.id);
    if (admin.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const hoy = new Date();
    const empresas = await Tenant.find({ estado: true });
    const pendientes = [];
    
    for (const empresa of empresas) {
      const fechaCreacion = new Date(empresa.fechaCreacion);
      const ultimoPago = await Pago.findOne({ tenantId: empresa.tenantId }).sort({ fechaPago: -1 });
      
      let ultimaFechaPago = fechaCreacion;
      if (ultimoPago) {
        ultimaFechaPago = new Date(ultimoPago.fechaPago);
      }
      
      // Calcular próxima fecha de vencimiento (mensual)
      const proximoVencimiento = new Date(ultimaFechaPago);
      proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);
      
      if (proximoVencimiento <= hoy) {
        const diasAtraso = Math.floor((hoy - proximoVencimiento) / (1000 * 60 * 60 * 24));
        pendientes.push({
          id: empresa._id,
          nombre: empresa.nombre,
          tenantId: empresa.tenantId,
          fechaVencimiento: proximoVencimiento.toISOString().split('T')[0],
          diasAtraso,
          montoPendiente: 350000,
          contacto: `admin@${empresa.tenantId}.com`,
          estado: empresa.estado
        });
      }
    }
    
    res.json(pendientes);
    
  } catch (error) {
    console.error('Error obteniendo pagos mensuales pendientes:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;