const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Cliente = require('../models/Cliente');

const handleRouteError = (res, error) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message });
};

const calcularTotalAPagar = (capital, interes) => {
  const capitalNumero = Number(capital);
  const interesNumero = Number(interes || 0);
  return Math.round(capitalNumero * (1 + interesNumero / 100));
};

// GET - Obtener prestamos (filtra segun rol)
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    
    console.log(`Obteniendo prestamos para tenant: ${tenantId}, usuario: ${user.email} (${user.rol})`);
    
    const query = { tenantId };
    
    if (user.rol === 'cobrador') {
      const clientes = await Cliente.find({ cobrador: user.id, tenantId });
      query.clienteId = { $in: clientes.map(c => c._id) };
    }
    
    const prestamos = await Prestamo.find(query)
      .populate('clienteId', 'nombre cedula telefono')
      .populate('creadoPor', 'nombre email rol')
      .sort({ createdAt: -1 });
    
    res.json(prestamos);
  } catch (error) {
    console.error('Error al obtener prestamos:', error);
    handleRouteError(res, error);
  }
});

// Rutas especificas antes de /:id para evitar que "cliente" se interprete como id.
router.get('/cliente/:clienteId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { clienteId } = req.params;
    
    const cliente = await Cliente.findOne({ _id: clienteId, tenantId });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    if (user.rol === 'cobrador' && cliente.cobrador?.toString() !== user.id) {
      return res.status(403).json({ error: 'No autorizado para ver los prestamos de este cliente' });
    }
    
    const prestamos = await Prestamo.find({ clienteId, tenantId })
      .populate('creadoPor', 'nombre email rol')
      .sort({ createdAt: -1 });
    
    res.json(prestamos);
  } catch (error) {
    console.error('Error al obtener prestamos del cliente:', error);
    handleRouteError(res, error);
  }
});

// GET - Obtener un prestamo por ID
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { id } = req.params;
    
    const prestamo = await Prestamo.findOne({ _id: id, tenantId })
      .populate('clienteId', 'nombre cedula telefono direccion')
      .populate('creadoPor', 'nombre email rol');
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Prestamo no encontrado' });
    }
    
    if (user.rol === 'cobrador') {
      const cliente = await Cliente.findOne({ _id: prestamo.clienteId._id, cobrador: user.id, tenantId });
      if (!cliente) {
        return res.status(403).json({ error: 'No autorizado para ver este prestamo' });
      }
    }
    
    res.json(prestamo);
  } catch (error) {
    console.error('Error al obtener prestamo por ID:', error);
    handleRouteError(res, error);
  }
});

// POST - Crear prestamo (admin y cobrador pueden, pero cobrador solo para sus clientes)
router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { clienteId, capital, interes, plazo, fechaInicio, fechaVencimiento } = req.body;
    
    const capitalNumero = Number(capital);
    const interesNumero = Number(interes || 0);
    const plazoNumero = Number(plazo);
    
    if (!clienteId || !capitalNumero || !plazoNumero || !fechaInicio || !fechaVencimiento) {
      return res.status(400).json({
        error: 'Cliente, capital, plazo, fechaInicio y fechaVencimiento son obligatorios'
      });
    }

    if (capitalNumero <= 0 || plazoNumero <= 0 || interesNumero < 0) {
      return res.status(400).json({ error: 'Capital y plazo deben ser mayores a 0; interes no puede ser negativo' });
    }
    
    const cliente = await Cliente.findOne({ _id: clienteId, tenantId });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    if (user.rol === 'cobrador' && cliente.cobrador?.toString() !== user.id) {
      return res.status(403).json({ error: 'No puede crear prestamo para este cliente' });
    }
    
    const total = calcularTotalAPagar(capitalNumero, interesNumero);
    
    const prestamo = new Prestamo({
      clienteId,
      capital: capitalNumero,
      interes: interesNumero,
      total,
      totalAPagar: total,
      totalPagado: 0,
      plazo: plazoNumero,
      fechaInicio: new Date(fechaInicio),
      fechaVencimiento: new Date(fechaVencimiento),
      estado: 'activo',
      tenantId,
      creadoPor: user.id,
      creadoPorRol: user.rol
    });
    
    await prestamo.save();
    
    const prestamoPopulado = await prestamo.populate('clienteId', 'nombre cedula');
    res.status(201).json(prestamoPopulado);
  } catch (error) {
    console.error('Error al crear prestamo:', error);
    handleRouteError(res, error);
  }
});

// PUT - Actualizar prestamo (solo admin)
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    
    if (user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado, solo administradores' });
    }

    const allowedFields = [
      'capital',
      'interes',
      'totalPagado',
      'plazo',
      'frecuencia',
      'fechaInicio',
      'fechaVencimiento',
      'estado',
      'ultimoPago',
      'notas'
    ];
    const update = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    if (update.capital !== undefined) update.capital = Number(update.capital);
    if (update.interes !== undefined) update.interes = Number(update.interes);
    if (update.totalPagado !== undefined) update.totalPagado = Number(update.totalPagado);
    if (update.plazo !== undefined) update.plazo = Number(update.plazo);
    if (update.fechaInicio !== undefined) update.fechaInicio = new Date(update.fechaInicio);
    if (update.fechaVencimiento !== undefined) update.fechaVencimiento = new Date(update.fechaVencimiento);
    if (update.ultimoPago !== undefined) update.ultimoPago = new Date(update.ultimoPago);

    if (update.capital !== undefined || update.interes !== undefined) {
      const prestamoActual = await Prestamo.findOne({ _id: req.params.id, tenantId });
      if (!prestamoActual) {
        return res.status(404).json({ error: 'Prestamo no encontrado' });
      }
      const capitalParaCalculo = update.capital !== undefined ? update.capital : prestamoActual.capital;
      const interesParaCalculo = update.interes !== undefined ? update.interes : prestamoActual.interes;
      update.total = calcularTotalAPagar(capitalParaCalculo, interesParaCalculo);
      update.totalAPagar = update.total;
    }
    
    const prestamo = await Prestamo.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      update,
      { new: true, runValidators: true }
    ).populate('clienteId', 'nombre cedula');
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Prestamo no encontrado' });
    }
    
    res.json(prestamo);
  } catch (error) {
    console.error('Error al actualizar prestamo:', error);
    handleRouteError(res, error);
  }
});

// DELETE - Eliminar prestamo (solo admin)
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    
    if (user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado, solo administradores' });
    }
    
    const prestamo = await Prestamo.findOneAndDelete({ _id: req.params.id, tenantId });
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Prestamo no encontrado' });
    }
    
    res.json({ message: 'Prestamo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar prestamo:', error);
    handleRouteError(res, error);
  }
});

module.exports = router;
