const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Pago = require('../models/Pago');
const Cobrador = require('../models/Cobrador'); // <-- IMPORTANTE: FALTABA ESTA LÍNEA
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Middleware para verificar tenantId
router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// ===== RUTA PRINCIPAL: Obtener resumen de cartera =====
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Total de préstamos activos
    const prestamosActivos = await Prestamo.find({ 
      tenantId, 
      estado: 'activo' 
    });
    
    const totalPrestamos = prestamosActivos.length;
    const capitalTotal = prestamosActivos.reduce((sum, p) => sum + p.capital, 0);
    const interesTotal = prestamosActivos.reduce((sum, p) => sum + (p.totalAPagar - p.capital), 0);
    const saldoPendiente = prestamosActivos.reduce((sum, p) => sum + (p.totalAPagar - (p.totalPagado || 0)), 0);
    
    // Pagos del día
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    const pagosHoy = await Pago.aggregate([
      {
        $match: {
          tenantId,
          fecha: { $gte: hoy, $lt: manana }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$monto" },
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    // Pagos del mes
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    finMes.setHours(23, 59, 59, 999);
    
    const pagosMes = await Pago.aggregate([
      {
        $match: {
          tenantId,
          fecha: { $gte: inicioMes, $lt: finMes }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$monto" },
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      resumen: {
        totalPrestamos,
        capitalTotal,
        interesTotal,
        saldoPendiente,
        totalAPagar: capitalTotal + interesTotal
      },
      pagos: {
        hoy: pagosHoy[0] || { total: 0, cantidad: 0 },
        mes: pagosMes[0] || { total: 0, cantidad: 0 }
      }
    });
  } catch (err) {
    console.error('❌ Error en GET /cartera:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== RUTA: Lista detallada para la tabla =====
router.get('/prestamos', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const prestamos = await Prestamo.find({ tenantId })
      .populate('cliente', 'nombre')
      .populate('cobrador', 'nombre')
      .sort({ createdAt: -1 });
    
    const resultado = prestamos.map(p => ({
      _id: p._id,
      cliente: p.cliente?.nombre || 'N/A',
      cobrador: p.cobrador?.nombre || 'N/A',
      capital: p.capital,
      totalAPagar: p.totalAPagar,
      totalPagado: p.totalPagado || 0,
      pendiente: p.totalAPagar - (p.totalPagado || 0),
      progreso: p.totalAPagar > 0 ? Math.round(((p.totalPagado || 0) / p.totalAPagar) * 100) : 0,
      estado: p.estado,
      fechaInicio: p.fechaInicio,
      fechaVencimiento: p.fechaVencimiento
    }));
    
    res.json(resultado);
  } catch (err) {
    console.error('❌ Error en GET /cartera/prestamos:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== RUTA: Cartera por cobrador =====
router.get('/cobradores', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const cobradores = await Cobrador.find({ tenantId, estado: 'activo' }).select('nombre cedula');
    
    const carteraPorCobrador = await Promise.all(cobradores.map(async (cobrador) => {
      const prestamos = await Prestamo.find({ 
        cobrador: cobrador._id, 
        estado: 'activo',
        tenantId 
      });
      
      const totalPrestamos = prestamos.length;
      const capitalTotal = prestamos.reduce((sum, p) => sum + p.capital, 0);
      const saldoPendiente = prestamos.reduce((sum, p) => sum + (p.totalAPagar - (p.totalPagado || 0)), 0);
      
      return {
        cobrador: {
          id: cobrador._id,
          nombre: cobrador.nombre,
          cedula: cobrador.cedula
        },
        estadisticas: {
          totalPrestamos,
          capitalTotal,
          saldoPendiente
        }
      };
    }));
    
    res.json(carteraPorCobrador);
  } catch (err) {
    console.error('❌ Error en GET /cartera/cobradores:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 🚀 NUEVA RUTA: Estadísticas para gráficos =====
router.get('/estadisticas', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    // Pagos por día (últimos 7 días)
    const hoy = new Date();
    const ultimos7Dias = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      fecha.setHours(0, 0, 0, 0);
      ultimos7Dias.push(fecha);
    }

    const pagosPorDia = await Promise.all(ultimos7Dias.map(async (fecha) => {
      const diaSiguiente = new Date(fecha);
      diaSiguiente.setDate(diaSiguiente.getDate() + 1);
      
      const pagos = await Pago.aggregate([
        {
          $match: {
            tenantId,
            fecha: { $gte: fecha, $lt: diaSiguiente }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$monto" },
            cantidad: { $sum: 1 }
          }
        }
      ]);
      
      return {
        fecha: fecha.toISOString().split('T')[0],
        total: pagos[0]?.total || 0,
        cantidad: pagos[0]?.cantidad || 0
      };
    }));

    // Préstamos por estado
    const prestamosPorEstado = await Prestamo.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: "$estado",
          cantidad: { $sum: 1 },
          total: { $sum: "$totalAPagar" }
        }
      }
    ]);

    // Top 5 cobradores por recaudación
    const topCobradores = await Pago.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: "$cobradorId",
          totalRecaudado: { $sum: "$monto" },
          cantidadPagos: { $sum: 1 }
        }
      },
      { $sort: { totalRecaudado: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "cobradors",
          localField: "_id",
          foreignField: "_id",
          as: "cobrador"
        }
      },
      {
        $project: {
          cobrador: { $arrayElemAt: ["$cobrador.nombre", 0] },
          totalRecaudado: 1,
          cantidadPagos: 1
        }
      }
    ]);

    res.json({
      pagosPorDia,
      prestamosPorEstado,
      topCobradores
    });
    
  } catch (err) {
    console.error('❌ Error en GET /cartera/estadisticas:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== 🚀 NUEVA RUTA: Resumen detallado de pagos =====
router.get('/pagos/resumen', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioAno = new Date(hoy.getFullYear(), 0, 1);
    
    // Pagos hoy
    const pagosHoy = await Pago.find({
      tenantId,
      fecha: { $gte: hoy }
    });
    
    // Pagos semana
    const pagosSemana = await Pago.find({
      tenantId,
      fecha: { $gte: inicioSemana }
    });
    
    // Pagos mes
    const pagosMes = await Pago.find({
      tenantId,
      fecha: { $gte: inicioMes }
    });
    
    // Pagos año
    const pagosAno = await Pago.find({
      tenantId,
      fecha: { $gte: inicioAno }
    });
    
    // Últimos 10 pagos
    const ultimosPagos = await Pago.find({ tenantId })
      .populate({
        path: 'prestamoId',
        populate: { path: 'cliente', select: 'nombre' }
      })
      .populate('cobradorId', 'nombre')
      .sort({ fecha: -1 })
      .limit(10);
    
    res.json({
      resumen: {
        hoy: {
          total: pagosHoy.reduce((sum, p) => sum + p.monto, 0),
          cantidad: pagosHoy.length
        },
        semana: {
          total: pagosSemana.reduce((sum, p) => sum + p.monto, 0),
          cantidad: pagosSemana.length
        },
        mes: {
          total: pagosMes.reduce((sum, p) => sum + p.monto, 0),
          cantidad: pagosMes.length
        },
        ano: {
          total: pagosAno.reduce((sum, p) => sum + p.monto, 0),
          cantidad: pagosAno.length
        }
      },
      ultimosPagos: ultimosPagos.map(p => ({
        _id: p._id,
        monto: p.monto,
        fecha: p.fecha,
        cliente: p.prestamoId?.cliente?.nombre || 'N/A',
        cobrador: p.cobradorId?.nombre || 'N/A'
      }))
    });
    
  } catch (err) {
    console.error('❌ Error en GET /cartera/pagos/resumen:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;