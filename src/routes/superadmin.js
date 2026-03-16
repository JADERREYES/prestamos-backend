const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');

const Tenant = require("../models/Tenant");
const Admin = require("../models/Admin");
const Cobrador = require("../models/Cobrador");
const Cliente = require("../models/Cliente");
const Prestamo = require("../models/Prestamo");

const { 
  generarPassword, 
  generarTenant,
  generarEmailAdmin,
  generarEmailCobrador,
  generarCodigoEmpresa
} = require("../utils/generarCredenciales");

/* =========================
   NUEVO: normalizador de tenantId
========================= */
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
    // Obtener token del header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_temporal');
    
    // Buscar usuario en la base de datos
    const user = await Admin.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // Verificar que sea superadmin (acepta ambas variantes)
    if (user.rol !== "superadmin" && user.rol !== "superadministrador") {
      return res.status(403).json({ error: "No autorizado - Se requiere rol de Super Admin" });
    }

    // Adjuntar usuario a la request
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

// ============ RUTAS PROTEGIDAS ============

// Obtener estadísticas globales
router.get("/stats", isSuperAdmin, async (req, res) => {
  try {
    console.log("📊 Obteniendo estadísticas globales");

    const [oficinas, clientes, cobradores, prestamos] = await Promise.all([
      Tenant.countDocuments(),
      Cliente ? Cliente.countDocuments() : 0,
      Cobrador.countDocuments(),
      Prestamo ? Prestamo.countDocuments() : 0
    ]);

    // Calcular cartera total
    let carteraTotal = 0;
    if (Prestamo) {
      const result = await Prestamo.aggregate([
        { $match: { estado: "activo" } },
        { $group: { _id: null, total: { $sum: "$monto" } } }
      ]);
      carteraTotal = result[0]?.total || 0;
    }

    res.json({
      oficinas,
      clientes,
      cobradores,
      prestamos,
      carteraTotal,
      prestamosActivos: 0,
      prestamosPagados: 0,
      prestamosVencidos: 0
    });
  } catch (err) {
    console.error("Error en stats:", err);
    res.status(500).json({ error: err.message });
  }
});

// Crear oficina - VERSIÓN CORREGIDA (sin doble hasheo)
router.post("/crear-oficina", isSuperAdmin, async (req, res) => {
  try {
    const { nombre, direccion, telefono } = req.body;

    console.log("🏗 Creando oficina:", nombre);

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }

    /* =========================
       NUEVO: generar y normalizar tenantId
    ========================= */
    const tenantGenerado = generarTenant(nombre);
    const tenantId = normalizarTenantId(tenantGenerado);

    const existe = await Tenant.findOne({ tenantId });

    if (existe) {
      return res.status(400).json({ error: "Ya existe una oficina con este nombre" });
    }

    const codigoEmpresa = generarCodigoEmpresa();

    const tenant = new Tenant({
      nombre: String(nombre || "").trim().toLowerCase(), // NUEVO: opcional, para consistencia visual
      direccion,
      telefono,
      tenantId,
      codigoEmpresa,
      estado: true,
      fechaCreacion: new Date()
    });

    await tenant.save();

    // Generar credenciales
    const adminPassword = generarPassword();
    const cobradorPassword = generarPassword();

    const adminEmail = generarEmailAdmin(tenantId).toLowerCase(); // Forzar minúsculas
    const cobradorEmail = generarEmailCobrador(tenantId).toLowerCase(); // Forzar minúsculas

    // ===== IMPORTANTE: NO HASHEAR AQUÍ =====
    // Los modelos Admin y Cobrador ya tienen un pre('save') que hashea automáticamente
    // Si hasheamos aquí, se hará DOBLE HASH y las contraseñas no funcionarán

    // Crear admin (con password SIN hashear - el modelo lo hará)
    const nuevoAdmin = new Admin({
      nombre: "Administrador",
      email: adminEmail,
      password: adminPassword, // ← PASAMOS LA CONTRASEÑA ORIGINAL, SIN HASHEAR
      rol: "admin",
      tenantId
    });
    await nuevoAdmin.save();

    // Crear cobrador (con password SIN hashear - el modelo lo hará)
    const nuevoCobrador = new Cobrador({
      nombre: "Cobrador Principal",
      email: cobradorEmail,
      cedula: `TEMP-${Date.now()}`,
      telefono: telefono || "000000000",
      password: cobradorPassword, // ← PASAMOS LA CONTRASEÑA ORIGINAL, SIN HASHEAR
      tenantId
    });
    await nuevoCobrador.save();

    // Verificación opcional (solo para desarrollo)
    const adminVerificado = await Admin.findById(nuevoAdmin._id).lean();
    const passwordFunciona = await bcrypt.compare(adminPassword, adminVerificado.password);
    if (!passwordFunciona) {
      console.error("⚠️ ERROR CRÍTICO: La contraseña del admin no se guardó correctamente");
    } else {
      console.log("✅ Contraseña de admin verificada correctamente");
    }

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
        password: adminPassword // Devolvemos la contraseña original
      },
      cobrador: {
        email: cobradorEmail,
        password: cobradorPassword // Devolvemos la contraseña original
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
    console.log("🏢 Obteniendo todas las oficinas");
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
    console.log("🔄 Cambiando estado de oficina:", req.params.id);
    
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
    console.log("🗑 Eliminando oficina:", req.params.id);
    
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Oficina no encontrada" });
    }

    /* =========================
       NUEVO: asegurar tenant normalizado
    ========================= */
    const tenantIdNormalizado = normalizarTenantId(tenant.tenantId);

    // Eliminar todos los datos relacionados
    await Promise.all([
      Admin.deleteMany({ tenantId: tenantIdNormalizado }),
      Cobrador.deleteMany({ tenantId: tenantIdNormalizado }),
      Cliente.deleteMany({ tenantId: tenantIdNormalizado }),
      Prestamo.deleteMany({ tenantId: tenantIdNormalizado }),
      Tenant.findByIdAndDelete(req.params.id)
    ]);

    res.json({ mensaje: "Oficina y todos sus datos eliminados correctamente" });
  } catch (err) {
    console.error("Error eliminando oficina:", err);
    res.status(500).json({ error: err.message });
  }
});

// Ruta de prueba (SIN middleware)
router.get("/test", (req, res) => {
  res.json({ 
    mensaje: "Ruta de superadmin funcionando",
    headers: req.headers,
    user: req.user || null
  });
});

module.exports = router;