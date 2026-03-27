const Tenant = require('../models/Tenant'); // Asegúrate de tener este modelo

exports.crearTenant = async (req, res) => {
  try {
    const nuevoTenant = new Tenant(req.body);
    await nuevoTenant.save();
    res.status(201).json(nuevoTenant);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear la empresa/oficina' });
  }
};

exports.listarTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find(); // Trae todas las empresas
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
};