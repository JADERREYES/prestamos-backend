const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const Cobrador = require('../models/Cobrador');
const Pago = require('../models/Pago');

// Middleware para verificar token de cobrador
const verifyCobradorToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_temporal');
    
    if (decoded.rol !== 'cobrador') {
      return res.status(403).json({ error: 'No autorizado - Se requiere rol de cobrador' });
    }
    
    req.cobradorId = decoded.id;
    req.tenantId = decoded.tenantId;
    console.log(`✅ Cobrador autenticado: ${decoded.id} en tenant: ${decoded.tenantId}`);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Aplicar middleware a todas las rutas
router.use(verifyCobradorToken);

// ===== CLIENTES =====
router.get('/clientes', async (req, res) => {
  try {
    console.log(`📋 Obteniendo clientes para tenant: ${req.tenantId}`);
    
    const clientes = await Cliente.find({ 
      tenantId: req.tenantId,
      cobrador: req.cobradorId
    }).sort({ createdAt: -1 });
    
    res.json(clientes);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clientes/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ 
      _id: req.params.id,
      tenantId: req.tenantId,
      cobrador: req.cobradorId
    });
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(cliente);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/clientes', async (req, res) => {
  try {
    console.log('📝 Creando nuevo cliente - Body:', req.body);
    
    const { nombre, cedula, celular, direccion, email, telefono } = req.body;
    
    if (!nombre || !cedula || !celular || !direccion) {
      return res.status(400).json({ error: 'Nombre, cédula, celular y dirección son requeridos' });
    }
    
    const existe = await Cliente.findOne({ cedula, tenantId: req.tenantId });
    
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un cliente con esta cédula' });
    }
    
    const cliente = new Cliente({
      nombre,
      cedula,
      celular,
      direccion,
      email: email || '',
      telefono: telefono || celular,
      cobrador: req.cobradorId,
      tenantId: req.tenantId,
      tipoCliente: 'nuevo',
      estado: 'activo'
    });
    
    await cliente.save();
    res.status(201).json(cliente);
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PRÉSTAMOS =====
router.get('/prestamos', async (req, res) => {
  try {
    console.log(`📊 Obteniendo préstamos para tenant: ${req.tenantId}`);
    
    const clientes = await Cliente.find({ 
      cobrador: req.cobradorId,
      tenantId: req.tenantId 
    }, '_id');
    
    const clienteIds = clientes.map(c => c._id);
    
    const prestamos = await Prestamo.find({ 
      cliente: { $in: clienteIds },
      tenantId: req.tenantId 
    })
    .populate('cliente', 'nombre cedula telefono')
    .sort({ createdAt: -1 });
    
    console.log(`✅ ${prestamos.length} préstamos encontrados`);
    res.json(prestamos);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/prestamos', async (req, res) => {
  try {
    console.log('📝 Creando nuevo préstamo:', req.body);
    
    const { clienteId, capital, interes, numeroCuotas, frecuencia } = req.body;
    
    if (!clienteId || !capital || capital <= 0) {
      return res.status(400).json({ error: 'Cliente y capital son requeridos' });
    }
    
    const cliente = await Cliente.findOne({ 
      _id: clienteId, 
      tenantId: req.tenantId,
      cobrador: req.cobradorId
    });
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const interesPorcentaje = interes || 20;
    const totalAPagar = capital * (1 + interesPorcentaje / 100);
    
    const prestamo = new Prestamo({
      cliente: clienteId,
      cobrador: req.cobradorId,
      capital,
      interes: interesPorcentaje,
      totalAPagar,
      totalPagado: 0,
      numeroCuotas: numeroCuotas || 30,
      frecuencia: frecuencia || 'diario',
      fechaInicio: new Date(),
      tenantId: req.tenantId,
      estado: 'activo'
    });
    
    await prestamo.save();
    await prestamo.populate('cliente', 'nombre cedula');
    
    res.status(201).json(prestamo);
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/clientes/:clienteId/prestamos', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ 
      _id: req.params.clienteId,
      cobrador: req.cobradorId,
      tenantId: req.tenantId 
    });
    
    if (!cliente) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const prestamos = await Prestamo.find({ 
      cliente: req.params.clienteId,
      tenantId: req.tenantId 
    })
    .populate('cliente', 'nombre cedula')
    .sort({ createdAt: -1 });
    
    res.json(prestamos);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PAGOS =====
// Registrar un pago
router.post('/pagos', async (req, res) => {
  try {
    console.log('💰💰💰 REGISTRO DE PAGO - INICIO');
    console.log('📦 Body recibido:', JSON.stringify(req.body, null, 2));
    console.log('👤 Cobrador ID:', req.cobradorId);
    console.log('🏢 Tenant ID:', req.tenantId);
    
    const { prestamoId, monto, fecha, metodo, observacion } = req.body;
    
    if (!prestamoId) {
      console.log('❌ Error: prestamoId no proporcionado');
      return res.status(400).json({ error: 'ID del préstamo es requerido' });
    }
    
    if (!monto || monto <= 0) {
      console.log('❌ Error: monto inválido:', monto);
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    
    console.log('🔍 Buscando préstamo:', prestamoId);
    
    const prestamo = await Prestamo.findById(prestamoId).populate('cliente');
    
    if (!prestamo) {
      console.log('❌ Préstamo no encontrado');
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    console.log('✅ Préstamo encontrado:', {
      id: prestamo._id,
      cliente: prestamo.cliente?.nombre,
      totalAPagar: prestamo.totalAPagar,
      totalPagado: prestamo.totalPagado
    });
    
    if (!prestamo.cliente) {
      console.log('❌ El préstamo no tiene cliente asociado');
      return res.status(400).json({ error: 'El préstamo no tiene cliente asociado' });
    }
    
    if (prestamo.cliente.cobrador.toString() !== req.cobradorId) {
      console.log('❌ No autorizado: el cliente pertenece a otro cobrador');
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    if (prestamo.estado !== 'activo') {
      console.log('❌ Préstamo no activo. Estado actual:', prestamo.estado);
      return res.status(400).json({ error: 'Este préstamo no está activo' });
    }
    
    const totalPagado = prestamo.totalPagado || 0;
    const saldoPendiente = prestamo.totalAPagar - totalPagado;
    
    console.log('💰 Saldo pendiente:', saldoPendiente);
    console.log('💰 Monto a pagar:', monto);
    
    if (monto > saldoPendiente) {
      console.log('❌ El monto excede el saldo pendiente');
      return res.status(400).json({ 
        error: 'El monto excede el saldo pendiente',
        saldoPendiente,
        montoIntentado: monto
      });
    }
    
    const pago = new Pago({
      prestamoId,
      monto,
      fecha: fecha ? new Date(fecha) : new Date(),
      cobradorId: req.cobradorId,
      tenantId: req.tenantId,
      metodo: metodo || 'efectivo',
      observacion: observacion || ''
    });
    
    console.log('📦 Guardando pago');
    await pago.save();
    console.log('✅ Pago guardado en DB. ID:', pago._id);
    
    const nuevoTotalPagado = totalPagado + monto;
    prestamo.totalPagado = nuevoTotalPagado;
    
    if (nuevoTotalPagado >= prestamo.totalAPagar) {
      prestamo.estado = 'pagado';
      console.log('🎉 Préstamo marcado como PAGADO');
    }
    
    await prestamo.save();
    console.log('✅ Préstamo actualizado. Nuevo total pagado:', nuevoTotalPagado);
    
    res.status(201).json({
      mensaje: 'Pago registrado exitosamente',
      pago,
      prestamo: {
        id: prestamo._id,
        totalPagado: prestamo.totalPagado,
        saldoPendiente: prestamo.totalAPagar - prestamo.totalPagado,
        estado: prestamo.estado
      }
    });
    
  } catch (error) {
    console.error('❌❌❌ ERROR EN REGISTRO DE PAGO:', error);
    res.status(500).json({ error: 'Error al registrar pago', details: error.message });
  }
});

// ===== NUEVA RUTA: Obtener pagos de un préstamo específico =====
router.get('/prestamos/:prestamoId/pagos', async (req, res) => {
  try {
    console.log(`📋 Obteniendo pagos del préstamo: ${req.params.prestamoId}`);
    
    // Verificar que el préstamo pertenezca a este cobrador
    const prestamo = await Prestamo.findById(req.params.prestamoId).populate('cliente');
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    if (!prestamo.cliente || prestamo.cliente.cobrador.toString() !== req.cobradorId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const pagos = await Pago.find({ 
      prestamoId: req.params.prestamoId,
      tenantId: req.tenantId 
    })
    .populate('cobradorId', 'nombre')
    .sort({ fecha: -1 });
    
    console.log(`✅ ${pagos.length} pagos encontrados`);
    res.json(pagos);
    
  } catch (error) {
    console.error('❌ Error obteniendo pagos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== NUEVA RUTA: Resumen de pagos para dashboard del cobrador =====
router.get('/pagos/resumen', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    // Pagos de hoy
    const pagosHoy = await Pago.find({
      cobradorId: req.cobradorId,
      tenantId: req.tenantId,
      fecha: { $gte: hoy, $lt: manana }
    });
    
    const totalHoy = pagosHoy.reduce((sum, p) => sum + p.monto, 0);
    
    // Total general
    const totalGeneral = await Pago.aggregate([
      { $match: { cobradorId: req.cobradorId, tenantId: req.tenantId } },
      { $group: { _id: null, total: { $sum: "$monto" } } }
    ]);
    
    res.json({
      pagosHoy: pagosHoy.length,
      totalHoy,
      totalGeneral: totalGeneral[0]?.total || 0
    });
    
  } catch (error) {
    console.error('❌ Error en resumen de pagos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTA DE PRUEBA =====
router.get('/test', (req, res) => {
  res.json({ 
    mensaje: 'Router de cobrador funcionando',
    cobradorId: req.cobradorId,
    tenantId: req.tenantId
  });
});

// ¡IMPORTANTE! Exportar el router
module.exports = router;