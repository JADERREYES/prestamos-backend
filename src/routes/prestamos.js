const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Cliente = require('../models/Cliente');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET préstamos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, cobrador: cobradorFilter } = req.query;
    let query = {};

    if (req.user.rol === 'cobrador') {
      query.cobrador = req.user.id;
    } else if (cobradorFilter) {
      query.cobrador = cobradorFilter;
    }

    const prestamos = await Prestamo.find(query)
      .populate('cliente', 'nombre cedula')
      .populate('cobrador', 'nombre cedula')
      .sort({ createdAt: -1 });

    let result = prestamos;
    if (search) {
      result = prestamos.filter(p =>
        p.cliente?.nombre?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET préstamos de un cliente específico
router.get('/cliente/:clienteId', authMiddleware, async (req, res) => {
  try {
    const prestamos = await Prestamo.find({ cliente: req.params.clienteId })
      .populate('cliente', 'nombre cedula')
      .populate('cobrador', 'nombre cedula')
      .sort({ createdAt: -1 });
    res.json(prestamos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET préstamo por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id)
      .populate('cliente', 'nombre cedula celular direccion')
      .populate('cobrador', 'nombre cedula');
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado' });
    res.json(prestamo);
  } catch (err) {
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
      const cliente = await Cliente.findById(clienteId);
      if (!cliente || cliente.cobrador.toString() !== req.user.id) {
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
      notas
    });

    await prestamo.save();
    const populated = await prestamo.populate([
      { path: 'cliente', select: 'nombre cedula' },
      { path: 'cobrador', select: 'nombre cedula' }
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar préstamo
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const prestamo = await Prestamo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(prestamo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
