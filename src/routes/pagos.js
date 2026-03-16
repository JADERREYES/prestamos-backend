const express = require('express');
const router = express.Router();
const Pago = require('../models/Pago');
const Prestamo = require('../models/Prestamo');
const { authMiddleware } = require('../middleware/auth');

router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// Registrar un pago
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { prestamoId, monto, fecha, metodo, observacion } = req.body;
    
    // Verificar que el préstamo existe y pertenece a la tenant
    const prestamo = await Prestamo.findOne({ 
      _id: prestamoId, 
      tenantId: req.tenantId 
    });
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    const pago = new Pago({
      prestamoId,
      monto,
      fecha: fecha || new Date(),
      cobradorId: req.user.id,
      tenantId: req.tenantId,
      metodo: metodo || 'efectivo',
      observacion
    });
    
    await pago.save();
    
    // Actualizar total pagado del préstamo
    prestamo.totalPagado = (prestamo.totalPagado || 0) + monto;
    await prestamo.save();
    
    res.status(201).json(pago);
  } catch (err) {
    console.error('❌ Error en POST /pagos:', err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener pagos de un préstamo
router.get('/prestamo/:prestamoId', authMiddleware, async (req, res) => {
  try {
    const pagos = await Pago.find({ 
      prestamoId: req.params.prestamoId,
      tenantId: req.tenantId 
    }).sort({ fecha: -1 });
    
    res.json(pagos);
  } catch (err) {
    console.error('❌ Error en GET /pagos/prestamo/:prestamoId:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;