const express = require('express');
const router = express.Router();
const Inventario = require('../models/Inventario');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search, cobrador } = req.query;
    let query = {};
    if (cobrador) query.cobrador = cobrador;
    
    const items = await Inventario.find(query).populate('cobrador', 'nombre cedula');
    
    let result = items;
    if (search) {
      result = items.filter(i =>
        i.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
        i.tipo?.toLowerCase().includes(search.toLowerCase()) ||
        i.cobrador?.nombre?.toLowerCase().includes(search.toLowerCase())
      );
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = new Inventario(req.body);
    if (req.body.cobrador) {
      item.fechaAsignacion = new Date();
      item.estado = 'asignado';
    }
    await item.save();
    const populated = await item.populate('cobrador', 'nombre cedula');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const update = req.body;
    if (update.cobrador) {
      update.fechaAsignacion = new Date();
      update.estado = 'asignado';
    }
    const item = await Inventario.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('cobrador', 'nombre cedula');
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Inventario.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
