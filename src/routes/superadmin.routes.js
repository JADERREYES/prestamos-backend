const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Tenant = require('../models/Tenant');
const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');

const { 
  generarPassword, 
  generarTenant,
  generarEmailAdmin,
  generarEmailCobrador,
  generarCodigoEmpresa
} = require('../utils/generarCredenciales');

// Normalizador de tenantId
const normalizarTenantId = (valor) => {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

// Middleware para verificar token y rol de Super Admin
const isSuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_temporal');
    const user = await Admin.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    if (user.rol !== "superadmin" && user.rol !== "superadministrador") {
      return res.status(403).json({ error: "No autorizado - Se requiere rol de Super Admin" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error en middleware superadmin:", error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: "Token inválido" });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expirado" });
    }
    res.status(500).json({ error: "Error de autenticación" });
  }
};

// Obtener estadísticas globales
router.get("/stats", isSuperAdmin, async (req, res) => {
  try {
    console.log("📊 Obteniendo estadísticas globales");

    const oficinas = await Tenant.countDocuments();
    const clientes = await Cliente.countDocuments();
    const cobradores = await Cobrador.countDocuments();
    const prestamos = await Prestamo.countDocuments();

    const prestamosActivos = await Prestamo.countDocuments({ estado: "activo" });
    const prestamosPagados = await Prestamo.countDocuments({ estado: "pagado" });
    const prestamosVencidos = await Prestamo.countDocuments({ estado: "vencido" });

    let carteraTotal = 0;
    const prestamosActivosList = await Prestamo.find({ estado: "activo" });
    carteraTotal = prestamosActivosList.reduce((sum, p) => sum + (p.totalAPagar - (p.totalPagado || 0)), 0);

    res.json({
      oficinas,
      clientes,
      cobradores,
      prestamos,
      carteraTotal,
      prestamosActivos,
      prestamosPagados,
      prestamosVencidos
    });
  } catch (err) {
    console.error("Error en stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// Crear oficina
router.post("/crear-oficina", isSuperAdmin, async (req, res) => {
  try {
    const { nombre, direccion, telefono } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }

    const tenantGenerado = generarTenant(nombre);
    const tenantId = normalizarTenantId(tenantGenerado);

    const existe = await Tenant.findOne({ tenantId });

    if (existe) {
      return res.status(400).json({ error: "Ya existe una oficina con este nombre" });
    }

    const codigoEmpresa = generarCodigoEmpresa();

    const tenant = new Tenant({
      nombre: String(nombre || "").trim(),
      direccion: direccion || "",
      telefono: telefono || "",
      tenantId,
      codigoEmpresa,
      estado: true,
      fechaCreacion: new Date()
    });

    await tenant.save();

    const adminPassword = generarPassword();
    const cobradorPassword = generarPassword();

    const adminEmail = generarEmailAdmin(tenantId).toLowerCase();
    const cobradorEmail = generarEmailCobrador(tenantId).toLowerCase();

    const nuevoAdmin = new Admin({
      nombre: "Administrador",
      email: adminEmail,
      password: adminPassword,
      rol: "admin",
      tenantId
    });
    await nuevoAdmin.save();

    const nuevoCobrador = new Cobrador({
      nombre: "Cobrador Principal",
      email: cobradorEmail,
      cedula: `TEMP-${Date.now()}`,
      telefono: telefono || "000000000",
      password: cobradorPassword,
      tenantId
    });
    await nuevoCobrador.save();

    res.json({
      mensaje: "Oficina creada exitosamente",
      tenant: {
        _id: tenant._id,
        nombre: tenant.nombre,
        tenantId: tenant.tenantId,
        codigoEmpresa
      },
      admin: {
        email: adminEmail,
        password: adminPassword
      },
      cobrador: {
        email: cobradorEmail,
        password: cobradorPassword
      }
    });
  } catch (err) {
    console.error("Error creando oficina:", err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener todas las oficinas
router.get("/oficinas", isSuperAdmin, async (req, res) => {
  try {
    const oficinas = await Tenant.find().sort({ fechaCreacion: -1 });
    res.json(oficinas);
  } catch (err) {
    console.error("Error en oficinas:", err);
    res.status(500).json({ error: err.message });
  }
});

// Cambiar estado de oficina
router.put("/oficinas/:id", isSuperAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Oficina no encontrada" });
    }

    tenant.estado = !tenant.estado;
    await tenant.save();
    
    res.json(tenant);
  } catch (err) {
    console.error("Error cambiando estado:", err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar oficina
router.delete("/oficinas/:id", isSuperAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Oficina no encontrada" });
    }

    const tenantIdNormalizado = normalizarTenantId(tenant.tenantId);

    await Admin.deleteMany({ tenantId: tenantIdNormalizado });
    await Cobrador.deleteMany({ tenantId: tenantIdNormalizado });
    await Cliente.deleteMany({ tenantId: tenantIdNormalizado });
    await Prestamo.deleteMany({ tenantId: tenantIdNormalizado });
    await Tenant.findByIdAndDelete(req.params.id);

    res.json({ 
      mensaje: "Oficina y todos sus datos eliminados correctamente"
    });
  } catch (err) {
    console.error("Error eliminando oficina:", err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener detalles de una oficina específica
router.get("/oficinas/:id/detalle", isSuperAdmin, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Oficina no encontrada" });
    }

    const tenantIdNormalizado = normalizarTenantId(tenant.tenantId);
    
    const admins = await Admin.find({ tenantId: tenantIdNormalizado }).select('-password');
    const cobradores = await Cobrador.find({ tenantId: tenantIdNormalizado }).select('-password');
    const clientes = await Cliente.find({ tenantId: tenantIdNormalizado });
    const prestamos = await Prestamo.find({ tenantId: tenantIdNormalizado });

    const totalPrestamos = prestamos.length;
    const prestamosActivos = prestamos.filter(p => p.estado === "activo").length;
    const totalRecaudado = prestamos.reduce((sum, p) => sum + (p.totalPagado || 0), 0);
    const carteraActual = prestamos.reduce((sum, p) => sum + (p.totalAPagar - (p.totalPagado || 0)), 0);

    res.json({
      tenant,
      stats: {
        admins: admins.length,
        cobradores: cobradores.length,
        clientes: clientes.length,
        totalPrestamos,
        prestamosActivos,
        totalRecaudado,
        carteraActual
      },
      admins,
      cobradores
    });
  } catch (err) {
    console.error("Error obteniendo detalle:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;