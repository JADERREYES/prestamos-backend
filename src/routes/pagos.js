const express = require('express');
const router = express.Router();
const Pago = require('../models/Pago');
const Prestamo = require('../models/Prestamo');
const { authMiddleware } = require('../middleware/auth');

// GET pagos de un préstamo
router.get('/prestamo/:prestamoId', authMiddleware, async (req, res) => {
  try {
    const pagos = await Pago.find({ prestamo: req.params.prestamoId })
      .populate('cobrador', 'nombre')
      .sort({ fechaPago: -1 });
    res.json(pagos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST registrar pago
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { prestamoId, monto, notas } = req.body;
    
    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado' });
    if (prestamo.estado === 'pagado') return res.status(400).json({ error: 'Préstamo ya pagado' });

    // Verificar que cobrador tiene acceso
    if (req.user.rol === 'cobrador' && prestamo.cobrador.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const pago = new Pago({
      prestamo: prestamoId,
      cliente: prestamo.cliente,
      cobrador: req.user.rol === 'cobrador' ? req.user.id : prestamo.cobrador,
      monto,
      notas
    });
    await pago.save();

    // Actualizar préstamo
    prestamo.totalPagado += monto;
    if (prestamo.totalPagado >= prestamo.totalAPagar) {
      prestamo.estado = 'pagado';
      prestamo.totalPagado = prestamo.totalAPagar;
    }
    await prestamo.save();

    res.status(201).json({ pago, prestamo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
