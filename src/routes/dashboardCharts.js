const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Pago = require('../models/Pago');
const Cliente = require('../models/Cliente');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// Datos para gráficas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const hoy = new Date();
    
    // Préstamos por estado
    const prestamosPorEstado = await Prestamo.aggregate([
      { $match: { tenantId } },
      { $group: { _id: "$estado", count: { $sum: 1 } } }
    ]);
    
    // Préstamos por cobrador
    const prestamosPorCobrador = await Prestamo.aggregate([
      { $match: { tenantId, estado: 'activo' } },
      { $group: { _id: "$cobrador", total: { $sum: "$capital" }, count: { $sum: 1 } } },
      { $lookup: { from: 'cobradors', localField: '_id', foreignField: '_id', as: 'cobrador' } },
      { $unwind: { path: '$cobrador', preserveNullAndEmptyArrays: true } }
    ]);
    
    // Préstamos por día (últimos 30 días)
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() - 30);
    
    const prestamosPorDia = await Prestamo.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: fechaLimite }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          capital: { $sum: "$capital" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    // Pagos por día (últimos 30 días)
    const pagosPorDia = await Pago.aggregate([
      {
        $match: {
          tenantId,
          fecha: { $gte: fechaLimite }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$fecha" } },
          total: { $sum: "$monto" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    // Clientes por tipo
    const clientesPorTipo = await Cliente.aggregate([
      { $match: { tenantId } },
      { $group: { _id: "$tipoCliente", count: { $sum: 1 } } }
    ]);
    
    res.json({
      prestamosPorEstado,
      prestamosPorCobrador,
      prestamosPorDia,
      pagosPorDia,
      clientesPorTipo
    });
  } catch (err) {
    console.error('❌ Error en GET /dashboard-charts:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;