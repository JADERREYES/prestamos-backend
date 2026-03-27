const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const Inventario = require('../models/Inventario');

// Middleware para verificar tenantId
router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// GET todos los items del inventario
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search, cobrador, estado, tipo } = req.query;
    let query = { tenantId: req.tenantId };
    
    if (search) {
      query.$or = [
        { tipo: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } },
        { serie: { $regex: search, $options: 'i' } },
        { marca: { $regex: search, $options: 'i' } },
        { modelo: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (cobrador && cobrador !== '') {
      query.cobrador = cobrador;
    }
    
    if (estado && estado !== '') {
      query.estado = estado;
    }
    
    if (tipo && tipo !== '') {
      query.tipo = { $regex: tipo, $options: 'i' };
    }
    
    const items = await Inventario.find(query)
      .populate('cobrador', 'nombre cedula email telefono')
      .sort({ createdAt: -1 });
    
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
    }).populate('cobrador', 'nombre cedula email telefono');
    
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
    const { tipo, descripcion, serie, cobrador, estado, marca, modelo, valor, notas } = req.body;
    
    const item = new Inventario({
      tipo,
      descripcion,
      serie: serie || '',
      cobrador: cobrador || null,
      estado: cobrador ? 'asignado' : (estado || 'disponible'),
      marca: marca || '',
      modelo: modelo || '',
      valor: valor || 0,
      notas: notas || '',
      tenantId: req.tenantId
    });
    
    await item.save();
    const populatedItem = await Inventario.findById(item._id).populate('cobrador', 'nombre cedula email');
    
    res.status(201).json(populatedItem);
  } catch (err) {
    console.error('❌ Error en POST /inventario:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar item
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { tipo, descripcion, serie, cobrador, estado, marca, modelo, valor, notas } = req.body;
    
    const item = await Inventario.findOne({ 
      _id: req.params.id, 
      tenantId: req.tenantId 
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    
    // Actualizar campos
    if (tipo) item.tipo = tipo;
    if (descripcion) item.descripcion = descripcion;
    if (serie !== undefined) item.serie = serie;
    if (marca !== undefined) item.marca = marca;
    if (modelo !== undefined) item.modelo = modelo;
    if (valor !== undefined) item.valor = valor;
    if (notas !== undefined) item.notas = notas;
    
    // Manejar asignación a cobrador
    const cobradorAnterior = item.cobrador ? item.cobrador.toString() : null;
    const cobradorNuevo = cobrador || null;
    
    if (cobradorNuevo !== cobradorAnterior) {
      item.cobrador = cobradorNuevo;
      if (cobradorNuevo) {
        item.fechaAsignacion = new Date();
        item.estado = 'asignado';
      } else {
        item.fechaAsignacion = null;
        item.estado = estado || 'disponible';
      }
    } else if (estado && !cobradorNuevo) {
      item.estado = estado;
    }
    
    await item.save();
    const populatedItem = await Inventario.findById(item._id).populate('cobrador', 'nombre cedula email');
    
    res.json(populatedItem);
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

// GET estadísticas de inventario
router.get('/stats/resumen', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const total = await Inventario.countDocuments({ tenantId });
    const disponibles = await Inventario.countDocuments({ tenantId, estado: 'disponible' });
    const asignados = await Inventario.countDocuments({ tenantId, estado: 'asignado' });
    const mantenimiento = await Inventario.countDocuments({ tenantId, estado: 'mantenimiento' });
    
    // Items por cobrador
    const porCobrador = await Inventario.aggregate([
      { $match: { tenantId, cobrador: { $ne: null } } },
      { $group: { _id: '$cobrador', count: { $sum: 1 } } },
      { $lookup: { from: 'cobradors', localField: '_id', foreignField: '_id', as: 'cobradorInfo' } },
      { $unwind: { path: '$cobradorInfo', preserveNullAndEmptyArrays: true } },
      { $project: { nombre: '$cobradorInfo.nombre', count: 1 } }
    ]);
    
    res.json({
      total,
      disponibles,
      asignados,
      mantenimiento,
      porCobrador
    });
  } catch (err) {
    console.error('❌ Error en GET /inventario/stats/resumen:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;