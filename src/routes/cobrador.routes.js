const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const Pago = require('../models/Pago');
const { verifyToken } = require('../utils/jwt');

const verifyCobradorToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = verifyToken(token);
    
    if (decoded.rol !== 'cobrador') {
      return res.status(403).json({ error: 'No autorizado - Se requiere rol de cobrador' });
    }

    if (!decoded.tenantId) {
      return res.status(400).json({ error: 'Tenant no definido en token' });
    }
    
    req.cobradorId = decoded.id;
    req.tenantId = decoded.tenantId;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido' });
  }
};

const handleError = (res, error) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: error.message });
};

const buildFechaVencimiento = (fechaInicio, plazo) => {
  const vencimiento = new Date(fechaInicio);
  vencimiento.setDate(vencimiento.getDate() + Number(plazo || 30));
  return vencimiento;
};

router.use(verifyCobradorToken);

router.get('/clientes', async (req, res) => {
  try {
    const clientes = await Cliente.find({
      tenantId: req.tenantId,
      cobrador: req.cobradorId,
      activo: true
    }).sort({ createdAt: -1 });
    
    res.json(clientes);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/clientes/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      cobrador: req.cobradorId,
      activo: true
    });
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(cliente);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/clientes', async (req, res) => {
  try {
    const { nombre, cedula, celular, direccion, email, telefono, tipo } = req.body;
    
    if (!nombre || !cedula || !(telefono || celular)) {
      return res.status(400).json({ error: 'Nombre, cedula y telefono son requeridos' });
    }
    
    const existe = await Cliente.findOne({ cedula, tenantId: req.tenantId });
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un cliente con esta cedula en esta oficina' });
    }
    
    const cliente = new Cliente({
      nombre,
      cedula,
      direccion: direccion || '',
      email: email || '',
      telefono: telefono || celular,
      cobrador: req.cobradorId,
      tenantId: req.tenantId,
      tipo: tipo || 'nuevo',
      activo: true
    });
    
    await cliente.save();
    res.status(201).json(cliente);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prestamos', async (req, res) => {
  try {
    const clientes = await Cliente.find({
      cobrador: req.cobradorId,
      tenantId: req.tenantId,
      activo: true
    }, '_id');
    
    const prestamos = await Prestamo.find({
      clienteId: { $in: clientes.map(c => c._id) },
      tenantId: req.tenantId
    })
      .populate('clienteId', 'nombre cedula telefono')
      .sort({ createdAt: -1 });
    
    res.json(prestamos);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/prestamos', async (req, res) => {
  try {
    const { clienteId, capital, interes, numeroCuotas, plazo, frecuencia, fechaInicio, fechaVencimiento } = req.body;
    const capitalNumero = Number(capital);
    const interesNumero = Number(interes || 20);
    const plazoFinal = Number(plazo || numeroCuotas || 30);
    
    if (!clienteId || !capitalNumero || capitalNumero <= 0 || !plazoFinal || plazoFinal <= 0) {
      return res.status(400).json({ error: 'Cliente, capital y plazo son requeridos' });
    }
    
    const cliente = await Cliente.findOne({
      _id: clienteId,
      tenantId: req.tenantId,
      cobrador: req.cobradorId,
      activo: true
    });
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
    const vencimiento = fechaVencimiento ? new Date(fechaVencimiento) : buildFechaVencimiento(inicio, plazoFinal);
    const totalAPagar = Math.round(capitalNumero * (1 + interesNumero / 100));
    
    const prestamo = new Prestamo({
      clienteId,
      capital: capitalNumero,
      interes: interesNumero,
      total: totalAPagar,
      totalAPagar,
      totalPagado: 0,
      plazo: plazoFinal,
      frecuencia: frecuencia || 'diario',
      fechaInicio: inicio,
      fechaVencimiento: vencimiento,
      tenantId: req.tenantId,
      creadoPor: req.cobradorId,
      creadoPorRol: 'cobrador',
      estado: 'activo'
    });
    
    await prestamo.save();
    await prestamo.populate('clienteId', 'nombre cedula');
    
    res.status(201).json(prestamo);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/clientes/:clienteId/prestamos', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      _id: req.params.clienteId,
      cobrador: req.cobradorId,
      tenantId: req.tenantId,
      activo: true
    });
    
    if (!cliente) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const prestamos = await Prestamo.find({
      clienteId: req.params.clienteId,
      tenantId: req.tenantId
    })
      .populate('clienteId', 'nombre cedula')
      .sort({ createdAt: -1 });
    
    res.json(prestamos);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/pagos', async (req, res) => {
  try {
    const { prestamoId, monto, fecha, metodo, metodoPago, observacion, referencia } = req.body;
    const montoNumero = Number(monto);
    
    if (!prestamoId) {
      return res.status(400).json({ error: 'ID del prestamo es requerido' });
    }
    
    if (!montoNumero || montoNumero <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    
    const prestamo = await Prestamo.findOne({ _id: prestamoId, tenantId: req.tenantId })
      .populate('clienteId');
    
    if (!prestamo || !prestamo.clienteId || prestamo.clienteId.cobrador?.toString() !== req.cobradorId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    if (prestamo.estado !== 'activo') {
      return res.status(400).json({ error: 'Este prestamo no esta activo' });
    }
    
    const saldoPendiente = prestamo.totalAPagar - (prestamo.totalPagado || 0);
    if (montoNumero > saldoPendiente) {
      return res.status(400).json({
        error: 'El monto excede el saldo pendiente',
        saldoPendiente,
        montoIntentado: montoNumero
      });
    }
    
    const pago = new Pago({
      prestamoId,
      clienteId: prestamo.clienteId._id,
      monto: montoNumero,
      fecha: fecha ? new Date(fecha) : new Date(),
      registradoPor: req.cobradorId,
      tenantId: req.tenantId,
      metodoPago: metodoPago || metodo || 'efectivo',
      referencia: referencia || observacion || ''
    });
    
    await pago.save();
    
    prestamo.totalPagado = (prestamo.totalPagado || 0) + montoNumero;
    if (prestamo.totalPagado >= prestamo.totalAPagar) {
      prestamo.estado = 'pagado';
    }
    prestamo.ultimoPago = new Date();
    await prestamo.save();
    
    res.status(201).json({
      mensaje: 'Pago registrado exitosamente',
      pago,
      prestamo: {
        id: prestamo._id,
        totalPagado: prestamo.totalPagado,
        saldoPendiente: prestamo.totalAPagar - prestamo.totalPagado,
        estado: prestamo.estado
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prestamos/:prestamoId/pagos', async (req, res) => {
  try {
    const prestamo = await Prestamo.findOne({ _id: req.params.prestamoId, tenantId: req.tenantId })
      .populate('clienteId');
    
    if (!prestamo || !prestamo.clienteId || prestamo.clienteId.cobrador?.toString() !== req.cobradorId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const pagos = await Pago.find({
      prestamoId: req.params.prestamoId,
      tenantId: req.tenantId
    })
      .populate('registradoPor', 'nombre')
      .sort({ fecha: -1 });
    
    res.json(pagos);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/pagos/resumen', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    const pagosHoy = await Pago.find({
      registradoPor: req.cobradorId,
      tenantId: req.tenantId,
      fecha: { $gte: hoy, $lt: manana }
    });
    
    const totalGeneral = await Pago.aggregate([
      { $match: { registradoPor: req.cobradorId, tenantId: req.tenantId } },
      { $group: { _id: null, total: { $sum: '$monto' } } }
    ]);
    
    res.json({
      pagosHoy: pagosHoy.length,
      totalHoy: pagosHoy.reduce((sum, p) => sum + p.monto, 0),
      totalGeneral: totalGeneral[0]?.total || 0
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/test', (req, res) => {
  res.json({
    mensaje: 'Router de cobrador funcionando',
    cobradorId: req.cobradorId,
    tenantId: req.tenantId
  });
});

module.exports = router;
