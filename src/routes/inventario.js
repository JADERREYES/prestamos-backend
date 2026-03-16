const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Modelo de inventario (si no existe, créalo)
let Inventario;
try {
  Inventario = require('../models/Inventario');
} catch (e) {
  // Si el modelo no existe, usar un esquema temporal
  const mongoose = require('mongoose');
  const inventarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    descripcion: String,
    cantidad: { type: Number, default: 0 },
    precio: Number,
    categoria: String,
    tenantId: { type: String, required: true, index: true },
    estado: { type: String, default: 'activo' }
  }, { timestamps: true });
  
  Inventario = mongoose.model('Inventario', inventarioSchema);
}

router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// GET todos los items
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search, categoria } = req.query;
    let query = { tenantId: req.tenantId };
    
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (categoria) {
      query.categoria = categoria;
    }
    
    const items = await Inventario.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('❌ Error en GET /inventario:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET item por ID
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = await Inventario.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    
    res.json(item);
  } catch (err) {
    console.error('❌ Error en GET /inventario/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST crear item
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = new Inventario({
      ...req.body,
      tenantId: req.tenantId
    });
    
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    console.error('❌ Error en POST /inventario:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar item
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = await Inventario.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    
    res.json(item);
  } catch (err) {
    console.error('❌ Error en PUT /inventario/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE eliminar item
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = await Inventario.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    
    res.json({ message: 'Item eliminado correctamente' });
  } catch (err) {
    console.error('❌ Error en DELETE /inventario/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;