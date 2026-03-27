const express = require('express');
const router = express.Router();
const Cliente = require('../models/Cliente');

// GET - Obtener todos los clientes (filtra según rol)
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { search } = req.query;
    
    console.log(`📋 Obteniendo clientes para tenant: ${tenantId}, usuario: ${user.email} (${user.rol})`);
    
    let query = { tenantId, activo: true };
    
    // Si es cobrador, solo ver sus clientes (los que él creó o le asignaron)
    if (user.rol === 'cobrador') {
      query.cobrador = user.id;
      console.log(`🔍 Cobrador ${user.email} filtra por sus clientes`);
    }
    
    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { cedula: { $regex: search, $options: 'i' } },
        { telefono: { $regex: search, $options: 'i' } }
      ];
    }
    
    const clientes = await Cliente.find(query)
      .populate('cobrador', 'nombre email')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Encontrados ${clientes.length} clientes para ${user.email}`);
    res.json(clientes);
  } catch (error) {
    console.error('❌ Error al obtener clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un cliente por ID
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { id } = req.params;
    
    let query = { _id: id, tenantId, activo: true };
    
    // Si es cobrador, solo puede ver sus clientes
    if (user.rol === 'cobrador') {
      query.cobrador = user.id;
    }
    
    const cliente = await Cliente.findOne(query).populate('cobrador', 'nombre email');
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(cliente);
  } catch (error) {
    console.error('❌ Error al obtener cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear cliente (admin y cobrador pueden)
router.post('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { nombre, cedula, telefono, direccion, email, tipo } = req.body;
    
    console.log(`📝 Creando cliente: ${nombre} por ${user.email} (${user.rol})`);
    
    if (!nombre || !cedula || !telefono) {
      return res.status(400).json({ error: 'Nombre, cédula y teléfono son requeridos' });
    }
    
    // Verificar si ya existe un cliente con la misma cédula en este tenant
    const existe = await Cliente.findOne({ cedula, tenantId });
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un cliente con esta cédula' });
    }
    
    // Crear cliente
    const cliente = new Cliente({
      nombre,
      cedula,
      telefono,
      direccion: direccion || '',
      email: email || '',
      tipo: tipo || 'regular',
      tenantId,
      activo: true,
      // Si es cobrador, se asigna a sí mismo; si es admin, puede quedar sin cobrador
      cobrador: user.rol === 'cobrador' ? user.id : null
    });
    
    await cliente.save();
    
    const clientePopulado = await cliente.populate('cobrador', 'nombre email');
    console.log(`✅ Cliente creado por ${user.email}`);
    res.status(201).json(clientePopulado);
  } catch (error) {
    console.error('❌ Error al crear cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar cliente
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    const { nombre, telefono, direccion, email, tipo, activo } = req.body;
    
    let query = { _id: req.params.id, tenantId };
    
    // Si es cobrador, solo puede editar sus clientes
    if (user.rol === 'cobrador') {
      query.cobrador = user.id;
    }
    
    const cliente = await Cliente.findOneAndUpdate(
      query,
      { nombre, telefono, direccion, email, tipo, activo },
      { new: true }
    ).populate('cobrador', 'nombre email');
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    console.log(`✅ Cliente actualizado por ${user.email}`);
    res.json(cliente);
  } catch (error) {
    console.error('❌ Error al actualizar cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar cliente (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const user = req.user;
    
    let query = { _id: req.params.id, tenantId };
    
    // Si es cobrador, solo puede eliminar sus clientes
    if (user.rol === 'cobrador') {
      query.cobrador = user.id;
    }
    
    const cliente = await Cliente.findOneAndUpdate(
      query,
      { activo: false },
      { new: true }
    );
    
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    console.log(`✅ Cliente desactivado por ${user.email}`);
    res.json({ message: 'Cliente desactivado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;