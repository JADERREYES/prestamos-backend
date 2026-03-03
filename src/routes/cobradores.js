const express = require('express');
const router = express.Router();
const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET todos los cobradores (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = { $or: [
        { nombre: { $regex: search, $options: 'i' } },
        { cedula: { $regex: search, $options: 'i' } },
        { telefono: { $regex: search, $options: 'i' } }
      ]};
    }
    const cobradores = await Cobrador.find(query).select('-password');
    
    // Agregar stats de cartera y clientes
    const cobradoresConStats = await Promise.all(cobradores.map(async (c) => {
      const clientes = await Cliente.countDocuments({ cobrador: c._id });
      const prestamos = await Prestamo.find({ cobrador: c._id, estado: { $in: ['activo'] } });
      const cartera = prestamos.reduce((sum, p) => sum + (p.totalAPagar - p.totalPagado), 0);
      return { ...c.toObject(), clientesCount: clientes, cartera };
    }));
    
    res.json(cobradoresConStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cobrador por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const cobrador = await Cobrador.findById(req.params.id).select('-password');
    if (!cobrador) return res.status(404).json({ error: 'Cobrador no encontrado' });
    res.json(cobrador);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST crear cobrador (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cobrador = new Cobrador(req.body);
    await cobrador.save();
    const { password, ...data } = cobrador.toObject();
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar cobrador (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { password, ...data } = req.body;
    const update = { ...data };
    if (password) {
      const bcrypt = require('bcryptjs');
      update.password = await bcrypt.hash(password, 10);
    }
    const cobrador = await Cobrador.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    res.json(cobrador);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cobrador (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Cobrador.findByIdAndUpdate(req.params.id, { estado: 'inactivo' });
    res.json({ message: 'Cobrador desactivado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
