const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Cliente = require('../models/Cliente');

// GET - Obtener préstamos (filtra según rol)
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    
    console.log(`📋 Obteniendo préstamos para tenant: ${tenantId}, usuario: ${user.email} (${user.rol})`);
    
    let query = { tenantId };
    
    // Si es cobrador, solo ver préstamos de sus clientes
    if (user.rol === 'cobrador') {
      const clientes = await Cliente.find({ cobrador: user.id, tenantId });
      const clientesIds = clientes.map(c => c._id);
      query.clienteId = { $in: clientesIds };
      console.log(`🔍 Cobrador ${user.email} filtra préstamos de ${clientesIds.length} clientes`);
    }
    
    const prestamos = await Prestamo.find(query)
      .populate('clienteId', 'nombre cedula telefono')
      .populate('creadoPor', 'nombre email rol')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Encontrados ${prestamos.length} préstamos para ${user.email}`);
    res.json(prestamos);
  } catch (error) {
    console.error('❌ Error al obtener préstamos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTA FALTANTE - Obtener un préstamo por ID
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { id } = req.params;
    
    console.log(`🔍 Obteniendo préstamo ID: ${id} para usuario: ${user.email} (${user.rol})`);
    
    // Buscar el préstamo
    const prestamo = await Prestamo.findOne({ _id: id, tenantId })
      .populate('clienteId', 'nombre cedula telefono direccion')
      .populate('creadoPor', 'nombre email rol');
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    // Si es cobrador, verificar que el préstamo pertenece a un cliente suyo
    if (user.rol === 'cobrador') {
      const cliente = await Cliente.findOne({ _id: prestamo.clienteId._id, cobrador: user.id, tenantId });
      if (!cliente) {
        return res.status(403).json({ error: 'No autorizado para ver este préstamo' });
      }
    }
    
    console.log(`✅ Préstamo encontrado para ${user.email}`);
    res.json(prestamo);
  } catch (error) {
    console.error('❌ Error al obtener préstamo por ID:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Préstamos de un cliente específico
router.get('/cliente/:clienteId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { clienteId } = req.params;
    
    // Verificar que el cliente existe y pertenece al tenant
    const cliente = await Cliente.findOne({ _id: clienteId, tenantId });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    // Si es cobrador, verificar que el cliente le pertenece
    if (user.rol === 'cobrador' && cliente.cobrador?.toString() !== user.id) {
      return res.status(403).json({ error: 'No autorizado para ver los préstamos de este cliente' });
    }
    
    const prestamos = await Prestamo.find({ clienteId, tenantId })
      .populate('creadoPor', 'nombre email rol')
      .sort({ createdAt: -1 });
    
    res.json(prestamos);
  } catch (error) {
    console.error('❌ Error al obtener préstamos del cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear préstamo (admin y cobrador pueden, pero cobrador solo para sus clientes)
router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { clienteId, capital, interes, plazo, fechaInicio, fechaVencimiento } = req.body;
    
    console.log(`📝 Creando préstamo por ${user.email} (${user.rol}) para cliente: ${clienteId}`);
    
    if (!clienteId || !capital || !plazo || !fechaInicio || !fechaVencimiento) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    
    // Verificar que el cliente existe
    const cliente = await Cliente.findOne({ _id: clienteId, tenantId });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    // Si es cobrador, verificar que el cliente le pertenece
    if (user.rol === 'cobrador' && cliente.cobrador?.toString() !== user.id) {
      return res.status(403).json({ error: 'No puede crear préstamo para este cliente' });
    }
    
    const total = capital + (interes || 0);
    
    const prestamo = new Prestamo({
      clienteId,
      capital,
      interes: interes || 0,
      total,
      totalAPagar: total,
      totalPagado: 0,
      plazo,
      fechaInicio: new Date(fechaInicio),
      fechaVencimiento: new Date(fechaVencimiento),
      estado: 'activo',
      tenantId,
      creadoPor: user.id,
      creadoPorRol: user.rol
    });
    
    await prestamo.save();
    
    const prestamoPopulado = await prestamo.populate('clienteId', 'nombre cedula');
    console.log(`✅ Préstamo creado por ${user.email} (${user.rol})`);
    res.status(201).json(prestamoPopulado);
  } catch (error) {
    console.error('❌ Error al crear préstamo:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar préstamo (solo admin)
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    
    // Solo admin puede editar préstamos
    if (user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado, solo administradores' });
    }
    
    const prestamo = await Prestamo.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      req.body,
      { new: true }
    ).populate('clienteId', 'nombre cedula');
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    console.log(`✅ Préstamo actualizado por ${user.email}`);
    res.json(prestamo);
  } catch (error) {
    console.error('❌ Error al actualizar préstamo:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar préstamo (solo admin)
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    
    if (user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado, solo administradores' });
    }
    
    const prestamo = await Prestamo.findOneAndDelete({ _id: req.params.id, tenantId });
    
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    
    console.log(`✅ Préstamo eliminado por ${user.email}`);
    res.json({ message: 'Préstamo eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar préstamo:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;