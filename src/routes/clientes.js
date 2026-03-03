const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET clientes - admin ve todos, cobrador ve los suyos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (req.user.rol === 'cobrador') {
      query.cobrador = req.user.id;
    }
    
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { cedula: { $regex: search, $options: 'i' } },
        { celular: { $regex: search, $options: 'i' } }
      ];
    }
    
    const clientes = await Cliente.find(query).populate('cobrador', 'nombre cedula');
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cliente por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id).populate('cobrador', 'nombre cedula');
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST crear cliente
router.post('/', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    // Si es cobrador, asignarse como cobrador
    if (req.user.rol === 'cobrador') {
      data.cobrador = req.user.id;
    }
    const cliente = new Cliente(data);
    await cliente.save();
    const populated = await cliente.populate('cobrador', 'nombre cedula');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar cliente
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('cobrador', 'nombre cedula');
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cliente
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Cliente.findByIdAndUpdate(req.params.id, { estado: 'inactivo' });
    res.json({ message: 'Cliente desactivado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
