const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Middleware para verificar tenantId
router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// GET clientes - admin ve todos, cobrador ve los suyos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    const tenantId = req.tenantId;
    
    let query = { tenantId };
    
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
    console.error('❌ Error en GET /clientes:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET cliente por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    }).populate('cobrador', 'nombre cedula');
    
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (err) {
    console.error('❌ Error en GET /clientes/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST crear cliente
router.post('/', authMiddleware, async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.tenantId };
    
    // Si es cobrador, asignarse como cobrador
    if (req.user.rol === 'cobrador') {
      data.cobrador = req.user.id;
    }
    
    // Verificar si ya existe un cliente con la misma cédula en esta tenant
    const existe = await Cliente.findOne({ 
      cedula: data.cedula, 
      tenantId: req.tenantId 
    });
    
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un cliente con esta cédula' });
    }
    
    const cliente = new Cliente(data);
    await cliente.save();
    const populated = await cliente.populate('cobrador', 'nombre cedula');
    res.status(201).json(populated);
  } catch (err) {
    console.error('❌ Error en POST /clientes:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar cliente
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const cliente = await Cliente.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true }
    ).populate('cobrador', 'nombre cedula');
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(cliente);
  } catch (err) {
    console.error('❌ Error en PUT /clientes/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE cliente
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cliente = await Cliente.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { estado: 'inactivo' },
      { new: true }
    );
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json({ message: 'Cliente desactivado' });
  } catch (err) {
    console.error('❌ Error en DELETE /clientes/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;