const Tenant = require('../models/Tenant');

exports.crearTenant = async (req, res) => {
  try {
    const nuevoTenant = new Tenant(req.body);
    await nuevoTenant.save();
    res.status(201).json(nuevoTenant);
  } catch (error) {
    console.error("Error al crear empresa:", error);
    res.status(400).json({ error: 'Error al crear la empresa/oficina', detalle: error.message });
  }
};

exports.listarTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ fechaCreacion: -1 });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
};

// Nueva función útil para el dashboard del Super Admin
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const totalEmpresas = await Tenant.countDocuments();
    const empresasActivas = await Tenant.countDocuments({ estado: true });
    res.json({ totalEmpresas, empresasActivas });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};