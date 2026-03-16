const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Pago = require('../models/Pago');
const { authMiddleware } = require('../middleware/auth');

router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// Obtener eventos del calendario (préstamos y pagos)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { mes, año } = req.query;
    const tenantId = req.tenantId;
    
    const fechaInicio = new Date(año, mes - 1, 1);
    const fechaFin = new Date(año, mes, 0);
    
    // Préstamos que vencen en el mes
    const prestamos = await Prestamo.find({
      tenantId,
      fechaVencimiento: { $gte: fechaInicio, $lte: fechaFin },
      estado: 'activo'
    }).populate('cliente', 'nombre');
    
    // Pagos realizados en el mes
    const pagos = await Pago.find({
      tenantId,
      fecha: { $gte: fechaInicio, $lte: fechaFin }
    }).populate({
      path: 'prestamoId',
      populate: { path: 'cliente', select: 'nombre' }
    });
    
    // Convertir a eventos para calendario
    const eventos = [
      ...prestamos.map(p => ({
        id: `prestamo-${p._id}`,
        title: `Vence: ${p.cliente?.nombre} - $${p.totalAPagar - p.totalPagado}`,
        start: p.fechaVencimiento,
        type: 'vencimiento',
        prestamoId: p._id,
        backgroundColor: '#f44336',
        borderColor: '#f44336'
      })),
      ...pagos.map(p => ({
        id: `pago-${p._id}`,
        title: `Pago: ${p.prestamoId?.cliente?.nombre} - $${p.monto}`,
        start: p.fecha,
        type: 'pago',
        pagoId: p._id,
        backgroundColor: '#4caf50',
        borderColor: '#4caf50'
      }))
    ];
    
    res.json(eventos);
  } catch (err) {
    console.error('❌ Error en GET /calendario:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener pagos de un día específico
router.get('/dia/:fecha', authMiddleware, async (req, res) => {
  try {
    const fecha = new Date(req.params.fecha);
    fecha.setHours(0, 0, 0, 0);
    const diaSiguiente = new Date(fecha);
    diaSiguiente.setDate(diaSiguiente.getDate() + 1);
    
    const pagos = await Pago.find({
      tenantId: req.tenantId,
      fecha: { $gte: fecha, $lt: diaSiguiente }
    }).populate({
      path: 'prestamoId',
      populate: { path: 'cliente', select: 'nombre cedula' }
    });
    
    res.json(pagos);
  } catch (err) {
    console.error('❌ Error en GET /calendario/dia/:fecha:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;