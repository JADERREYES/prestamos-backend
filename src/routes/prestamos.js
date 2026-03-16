const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Cliente = require('../models/Cliente');
const Pago = require('../models/Pago'); // <--- AGREGADO
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Middleware para verificar tenantId
router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// GET todos los préstamos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, cobrador: cobradorFilter } = req.query;
    let query = { tenantId: req.tenantId };

    if (req.user.rol === 'cobrador') {
      query.cobrador = req.user.id;
    } else if (cobradorFilter) {
      query.cobrador = cobradorFilter;
    }

    const prestamos = await Prestamo.find(query)
      .populate('cliente', 'nombre cedula')
      .populate('cobrador', 'nombre cedula')
      .sort({ createdAt: -1 });

    // Calcular saldo pendiente para cada préstamo
    const result = prestamos.map(p => ({
      ...p.toObject(),
      saldoPendiente: p.totalAPagar - (p.totalPagado || 0),
      porcentajePagado: ((p.totalPagado || 0) / p.totalAPagar * 100).toFixed(2)
    }));

    if (search) {
      return res.json(result.filter(p =>
        p.cliente?.nombre?.toLowerCase().includes(search.toLowerCase())
      ));
    }

    res.json(result);
  } catch (err) {
    console.error('❌ Error en GET /prestamos:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET préstamos de un cliente específico
router.get('/cliente/:clienteId', authMiddleware, async (req, res) => {
  try {
    const prestamos = await Prestamo.find({ 
      cliente: req.params.clienteId,
      tenantId: req.tenantId 
    })
    .populate('cliente', 'nombre cedula')
    .populate('cobrador', 'nombre cedula')
    .sort({ createdAt: -1 });
    
    // Calcular saldo pendiente
    const result = prestamos.map(p => ({
      ...p.toObject(),
      saldoPendiente: p.totalAPagar - (p.totalPagado || 0),
      porcentajePagado: ((p.totalPagado || 0) / p.totalAPagar * 100).toFixed(2)
    }));
    
    res.json(result);
  } catch (err) {
    console.error('❌ Error en GET /cliente/:clienteId:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET préstamo por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const prestamo = await Prestamo.findOne({ 
      _id: req.params.id,
      tenantId: req.tenantId 
    })
    .populate('cliente', 'nombre cedula celular direccion')
    .populate('cobrador', 'nombre cedula');
    
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado' });
    
    // Obtener pagos del préstamo
    const pagos = await Pago.find({ 
      prestamoId: req.params.id,
      tenantId: req.tenantId 
    }).sort({ fecha: -1 });
    
    res.json({
      ...prestamo.toObject(),
      saldoPendiente: prestamo.totalAPagar - (prestamo.totalPagado || 0),
      porcentajePagado: ((prestamo.totalPagado || 0) / prestamo.totalAPagar * 100).toFixed(2),
      pagos
    });
  } catch (err) {
    console.error('❌ Error en GET /prestamos/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== NUEVA RUTA: GET pagos de un préstamo específico =====
router.get('/:id/pagos', authMiddleware, async (req, res) => {
  try {
    const pagos = await Pago.find({ 
      prestamoId: req.params.id,
      tenantId: req.tenantId 
    })
    .populate('cobradorId', 'nombre')
    .sort({ fecha: -1 });
    
    res.json(pagos);
  } catch (err) {
    console.error('❌ Error en GET /prestamos/:id/pagos:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== NUEVA RUTA: GET resumen de pagos para dashboard =====
router.get('/pagos/resumen', authMiddleware, async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    // Pagos de hoy
    const pagosHoy = await Pago.find({
      tenantId: req.tenantId,
      fecha: { $gte: hoy, $lt: manana }
    });
    
    const totalHoy = pagosHoy.reduce((sum, p) => sum + p.monto, 0);
    
    // Pagos del mes
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    finMes.setHours(23, 59, 59, 999);
    
    const pagosMes = await Pago.find({
      tenantId: req.tenantId,
      fecha: { $gte: inicioMes, $lt: finMes }
    });
    
    const totalMes = pagosMes.reduce((sum, p) => sum + p.monto, 0);
    
    res.json({
      pagosHoy: pagosHoy.length,
      totalHoy,
      pagosMes: pagosMes.length,
      totalMes,
      ultimosPagos: await Pago.find({ tenantId: req.tenantId })
        .populate({
          path: 'prestamoId',
          populate: { path: 'cliente', select: 'nombre' }
        })
        .populate('cobradorId', 'nombre')
        .sort({ fecha: -1 })
        .limit(10)
    });
    
  } catch (err) {
    console.error('❌ Error en GET /pagos/resumen:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST crear préstamo
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { clienteId, capital, interes, numeroCuotas, frecuencia, notas } = req.body;
    
    const totalAPagar = Math.round(capital * (1 + interes / 100));
    
    // Calcular fecha vencimiento
    const fechaInicio = new Date();
    let fechaVencimiento = new Date(fechaInicio);
    if (frecuencia === 'diario') fechaVencimiento.setDate(fechaVencimiento.getDate() + numeroCuotas);
    else if (frecuencia === 'semanal') fechaVencimiento.setDate(fechaVencimiento.getDate() + numeroCuotas * 7);
    else if (frecuencia === 'quincenal') fechaVencimiento.setDate(fechaVencimiento.getDate() + numeroCuotas * 15);
    else fechaVencimiento.setMonth(fechaVencimiento.getMonth() + numeroCuotas);

    // Determinar cobrador
    let cobradorId = req.user.id;
    if (req.user.rol === 'admin' && req.body.cobradorId) {
      cobradorId = req.body.cobradorId;
    }
    
    if (req.user.rol === 'cobrador') {
      // Verificar que el cliente pertenece a este cobrador
      const cliente = await Cliente.findOne({ 
        _id: clienteId, 
        tenantId: req.tenantId 
      });
      
      if (!cliente || cliente.cobrador?.toString() !== req.user.id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    const prestamo = new Prestamo({
      cliente: clienteId,
      cobrador: cobradorId,
      capital,
      interes,
      totalAPagar,
      numeroCuotas,
      frecuencia: frecuencia || 'diario',
      fechaInicio,
      fechaVencimiento,
      notas,
      tenantId: req.tenantId,
      totalPagado: 0,
      estado: 'activo'
    });

    await prestamo.save();
    const populated = await prestamo.populate([
      { path: 'cliente', select: 'nombre cedula' },
      { path: 'cobrador', select: 'nombre cedula' }
    ]);
    
    res.status(201).json(populated);
  } catch (err) {
    console.error('❌ Error en POST /prestamos:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar préstamo (solo admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const prestamo = await Prestamo.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body, 
      { new: true }
    );
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    res.json(prestamo);
  } catch (err) {
    console.error('❌ Error en PUT /prestamos/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;