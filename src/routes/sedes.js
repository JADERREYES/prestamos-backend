const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Modelo de Sede
let Sede;
try {
  Sede = require('../models/Sede');
} catch (e) {
  const mongoose = require('mongoose');
  const sedeSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    direccion: String,
    telefono: String,
    tenantId: { type: String, required: true, index: true },
    estado: { type: String, default: 'activo' }
  }, { timestamps: true });
  
  Sede = mongoose.model('Sede', sedeSchema);
}

router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// GET todas las sedes
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sedes = await Sede.find({ tenantId: req.tenantId }).sort({ nombre: 1 });
    res.json(sedes);
  } catch (err) {
    console.error('❌ Error en GET /sedes:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET sede por ID
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sede = await Sede.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!sede) {
      return res.status(404).json({ error: 'Sede no encontrada' });
    }
    
    res.json(sede);
  } catch (err) {
    console.error('❌ Error en GET /sedes/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST crear sede
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sede = new Sede({
      ...req.body,
      tenantId: req.tenantId
    });
    
    await sede.save();
    res.status(201).json(sede);
  } catch (err) {
    console.error('❌ Error en POST /sedes:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar sede
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sede = await Sede.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    );
    
    if (!sede) {
      return res.status(404).json({ error: 'Sede no encontrada' });
    }
    
    res.json(sede);
  } catch (err) {
    console.error('❌ Error en PUT /sedes/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE eliminar sede
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sede = await Sede.findOneAndDelete({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!sede) {
      return res.status(404).json({ error: 'Sede no encontrada' });
    }
    
    res.json({ message: 'Sede eliminada correctamente' });
  } catch (err) {
    console.error('❌ Error en DELETE /sedes/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;