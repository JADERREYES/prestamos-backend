const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const Inventario = require('../models/Inventario');

const cleanString = (value) => String(value || '').trim();

const handleRouteError = (res, err) => {
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: err.message });
};

// Middleware para verificar tenantId. El tenant del JWT/middleware es la fuente de verdad.
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
    const query = { tenantId: req.tenantId };
    
    if (search) {
      query.$or = [
        { tipo: { $regex: search, $options: 'i' } },
        { descripcion: { $regex: search, $options: 'i' } },
        { serie: { $regex: search, $options: 'i' } },
        { marca: { $regex: search, $options: 'i' } },
        { modelo: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (cobrador) {
      query.cobrador = cobrador;
    }
    
    if (estado) {
      query.estado = estado;
    }
    
    if (tipo) {
      query.tipo = { $regex: tipo, $options: 'i' };
    }
    
    const items = await Inventario.find(query)
      .populate('cobrador', 'nombre cedula email telefono')
      .sort({ createdAt: -1 });
    
    res.json(items);
  } catch (err) {
    console.error('Error en GET /inventario:', err);
    handleRouteError(res, err);
  }
});

// Rutas especificas antes de /:id para evitar que Express interprete "stats" como id.
router.get('/stats/resumen', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const total = await Inventario.countDocuments({ tenantId });
    const disponibles = await Inventario.countDocuments({ tenantId, estado: 'disponible' });
    const asignados = await Inventario.countDocuments({ tenantId, estado: 'asignado' });
    const mantenimiento = await Inventario.countDocuments({ tenantId, estado: 'mantenimiento' });
    
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
    console.error('Error en GET /inventario/stats/resumen:', err);
    handleRouteError(res, err);
  }
});

// POST crear item
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { tipo, descripcion, serie, cobrador, estado, marca, modelo, valor, notas } = req.body;
    const tipoLimpio = cleanString(tipo);
    const descripcionLimpia = cleanString(descripcion);
    
    if (!tipoLimpio || !descripcionLimpia) {
      return res.status(400).json({ error: 'Tipo y descripcion son obligatorios' });
    }
    
    const item = new Inventario({
      tipo: tipoLimpio,
      descripcion: descripcionLimpia,
      serie: cleanString(serie),
      cobrador: cobrador || null,
      estado: cobrador ? 'asignado' : (estado || 'disponible'),
      marca: cleanString(marca),
      modelo: cleanString(modelo),
      valor: Number(valor) || 0,
      notas: cleanString(notas),
      tenantId: req.tenantId
    });
    
    await item.save();
    const populatedItem = await Inventario.findById(item._id).populate('cobrador', 'nombre cedula email');
    
    res.status(201).json(populatedItem);
  } catch (err) {
    console.error('Error en POST /inventario:', err);
    handleRouteError(res, err);
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
    console.error('Error en GET /inventario/:id:', err);
    handleRouteError(res, err);
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
    
    if (tipo !== undefined) {
      const tipoLimpio = cleanString(tipo);
      if (!tipoLimpio) return res.status(400).json({ error: 'Tipo es obligatorio' });
      item.tipo = tipoLimpio;
    }
    if (descripcion !== undefined) {
      const descripcionLimpia = cleanString(descripcion);
      if (!descripcionLimpia) return res.status(400).json({ error: 'Descripcion es obligatoria' });
      item.descripcion = descripcionLimpia;
    }
    if (serie !== undefined) item.serie = cleanString(serie);
    if (marca !== undefined) item.marca = cleanString(marca);
    if (modelo !== undefined) item.modelo = cleanString(modelo);
    if (valor !== undefined) item.valor = Number(valor) || 0;
    if (notas !== undefined) item.notas = cleanString(notas);
    
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
    console.error('Error en PUT /inventario/:id:', err);
    handleRouteError(res, err);
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
    console.error('Error en DELETE /inventario/:id:', err);
    handleRouteError(res, err);
  }
});

module.exports = router;
