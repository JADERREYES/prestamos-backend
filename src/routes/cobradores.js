const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Middleware para verificar tenantId
router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// GET todos los cobradores (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search } = req.query;
    const tenantId = req.tenantId;
    
    let query = { tenantId };
    
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { cedula: { $regex: search, $options: 'i' } },
        { telefono: { $regex: search, $options: 'i' } }
      ];
    }
    
    const cobradores = await Cobrador.find(query).select('-password');
    
    // Agregar stats de cartera y clientes
    const cobradoresConStats = await Promise.all(cobradores.map(async (c) => {
      const clientes = await Cliente.countDocuments({ cobrador: c._id, tenantId });
      const prestamos = await Prestamo.find({ cobrador: c._id, estado: { $in: ['activo'] }, tenantId });
      const cartera = prestamos.reduce((sum, p) => sum + (p.totalAPagar - p.totalPagado), 0);
      return { ...c.toObject(), clientesCount: clientes, cartera };
    }));
    
    res.json(cobradoresConStats);
  } catch (err) {
    console.error('❌ Error en GET /cobradores:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET cobrador por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const cobrador = await Cobrador.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    }).select('-password');
    
    if (!cobrador) return res.status(404).json({ error: 'Cobrador no encontrado' });
    res.json(cobrador);
  } catch (err) {
    console.error('❌ Error en GET /cobradores/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST crear cobrador (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.tenantId };
    
    // Verificar si ya existe
    const existe = await Cobrador.findOne({ 
      $or: [{ email: data.email }, { cedula: data.cedula }],
      tenantId: req.tenantId 
    });
    
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un cobrador con ese email o cédula' });
    }
    
    const cobrador = new Cobrador(data);
    await cobrador.save();
    const { password, ...cobradorData } = cobrador.toObject();
    res.status(201).json(cobradorData);
  } catch (err) {
    console.error('❌ Error en POST /cobradores:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar cobrador (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { password, ...data } = req.body;
    const update = { ...data };
    
    if (password) {
      update.password = await bcrypt.hash(password, 10);
    }
    
    const cobrador = await Cobrador.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      update,
      { new: true }
    ).select('-password');
    
    if (!cobrador) {
      return res.status(404).json({ error: 'Cobrador no encontrado' });
    }
    
    res.json(cobrador);
  } catch (err) {
    console.error('❌ Error en PUT /cobradores/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE cobrador (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cobrador = await Cobrador.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { estado: 'inactivo' },
      { new: true }
    );
    
    if (!cobrador) {
      return res.status(404).json({ error: 'Cobrador no encontrado' });
    }
    
    res.json({ message: 'Cobrador desactivado' });
  } catch (err) {
    console.error('❌ Error en DELETE /cobradores/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;