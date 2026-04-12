const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { verifyToken } = require('../utils/jwt');

const Tenant = require("../models/Tenant");
const Admin = require("../models/Admin");
const Cobrador = require("../models/Cobrador");
const Cliente = require("../models/Cliente");
const Prestamo = require("../models/Prestamo");
const MensualidadOficina = require("../models/MensualidadOficina");
const NotificacionOficina = require("../models/NotificacionOficina");
const superadminController = require('../controllers/superadmin.controller');
const { generarCodigoVinculacion } = require('../services/telegramCobrador.service');

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
      console.log("❌ Token no proporcionado");
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    // Verificar token
    const decoded = verifyToken(token);
    console.log("✅ Token verificado:", decoded.email);
    
    // Buscar usuario en la base de datos
    const user = await Admin.findById(decoded.id);
    
    if (!user) {
      console.log("❌ Usuario no encontrado:", decoded.id);
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // Verificar que sea superadmin (acepta ambas variantes)
    if (user.rol !== "superadmin" && user.rol !== "superadministrador") {
      console.log(`❌ Usuario no es superadmin. Rol: ${user.rol}`);
      return res.status(403).json({ error: "No autorizado - Se requiere rol de Super Admin" });
    }

    console.log(`✅ Super Admin autorizado: ${user.email}`);
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

// ============ RUTAS DEL CONTROLADOR (sin middleware) ============

// Ruta para obtener todas las empresas (oficinas)
router.get('/tenants', isSuperAdmin, superadminController.listarTenants);

// Ruta para crear una nueva empresa (oficina)
router.post('/tenants', isSuperAdmin, superadminController.crearTenant);

// Ruta para el dashboard inicial del superadmin
router.get('/dashboard-stats', isSuperAdmin, superadminController.obtenerEstadisticas);

// ============ RUTAS PROTEGIDAS CON MIDDLEWARE ============

// Obtener estadísticas globales
router.get("/stats", isSuperAdmin, async (req, res) => {
  try {
    console.log("📊 Obteniendo estadísticas globales");

    const oficinas = await Tenant.countDocuments();
    const clientes = await Cliente.countDocuments();
    const cobradores = await Cobrador.countDocuments();
    const prestamos = await Prestamo.countDocuments();

    // Calcular préstamos por estado
    const prestamosActivos = await Prestamo.countDocuments({ estado: "activo" });
    const prestamosPagados = await Prestamo.countDocuments({ estado: "pagado" });
    const prestamosVencidos = await Prestamo.countDocuments({ estado: "vencido" });

    // Calcular cartera total
    let carteraTotal = 0;
    const prestamosActivosList = await Prestamo.find({ estado: "activo" });
    carteraTotal = prestamosActivosList.reduce((sum, p) => sum + (p.totalAPagar - (p.totalPagado || 0)), 0);

    console.log(`📊 Estadísticas: ${oficinas} oficinas, ${clientes} clientes, ${cobradores} cobradores, ${prestamos} préstamos`);

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
      nombre: String(nombre || "").trim(),
      direccion: direccion || "",
      telefono: telefono || "",
      tenantId,
      codigoEmpresa,
      estado: true,
      fechaCreacion: new Date()
    });

    await tenant.save();
    console.log(`✅ Tenant creado: ${tenantId}`);

    // Generar credenciales
    const adminPassword = generarPassword();
    const cobradorPassword = generarPassword();

    const adminEmail = generarEmailAdmin(tenantId).toLowerCase();
    const cobradorEmail = generarEmailCobrador(tenantId).toLowerCase();

    console.log(`📧 Credenciales admin: ${adminEmail} / ${adminPassword}`);
    console.log(`📧 Credenciales cobrador: ${cobradorEmail} / ${cobradorPassword}`);

    // Crear admin (con password SIN hashear - el modelo lo hará)
    const nuevoAdmin = new Admin({
      nombre: "Administrador",
      email: adminEmail,
      password: adminPassword,
      rol: "admin",
      tenantId
    });
    await nuevoAdmin.save();
    console.log(`✅ Admin creado: ${adminEmail}`);

    // Crear cobrador (con password SIN hashear - el modelo lo hará)
    const nuevoCobrador = new Cobrador({
      nombre: "Cobrador Principal",
      email: cobradorEmail,
      cedula: `TEMP-${Date.now()}`,
      telefono: telefono || "000000000",
      password: cobradorPassword,
      tenantId
    });
    await nuevoCobrador.save();
    const codigoTelegram = await generarCodigoVinculacion({
      cobrador: nuevoCobrador,
      creadoPor: req.user._id,
      creadoPorRol: req.user.rol
    });
    console.log(`✅ Cobrador creado: ${cobradorEmail}`);

    // Verificación opcional
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
        password: adminPassword
      },
      cobrador: {
        email: cobradorEmail,
        password: cobradorPassword,
        telegramVinculacion: {
          codigo: codigoTelegram.codigo,
          expiraEn: codigoTelegram.expiraEn,
          cobradorId: nuevoCobrador._id,
          tenantId: nuevoCobrador.tenantId
        }
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
    console.log(`📋 Encontradas ${oficinas.length} oficinas`);
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
    
    console.log(`✅ Oficina ${tenant.nombre} ahora está ${tenant.estado ? "ACTIVA" : "INACTIVA"}`);

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

    console.log(`📦 Eliminando datos para tenant: ${tenantIdNormalizado}`);

    // Eliminar todos los datos relacionados
    const adminsDeleted = await Admin.deleteMany({ tenantId: tenantIdNormalizado });
    const cobradoresDeleted = await Cobrador.deleteMany({ tenantId: tenantIdNormalizado });
    const clientesDeleted = await Cliente.deleteMany({ tenantId: tenantIdNormalizado });
    const prestamosDeleted = await Prestamo.deleteMany({ tenantId: tenantIdNormalizado });
    const mensualidadesDeleted = await MensualidadOficina.deleteMany({ tenantId: tenantIdNormalizado });
    const notificacionesDeleted = await NotificacionOficina.deleteMany({ tenantId: tenantIdNormalizado });
    await Tenant.findByIdAndDelete(req.params.id);

    console.log(`✅ Eliminados: ${adminsDeleted.deletedCount} admins, ${cobradoresDeleted.deletedCount} cobradores, ${clientesDeleted.deletedCount} clientes, ${prestamosDeleted.deletedCount} préstamos`);

    res.json({ 
      mensaje: "Oficina y todos sus datos eliminados correctamente",
      stats: {
        admins: adminsDeleted.deletedCount,
        cobradores: cobradoresDeleted.deletedCount,
        clientes: clientesDeleted.deletedCount,
        prestamos: prestamosDeleted.deletedCount,
        mensualidades: mensualidadesDeleted.deletedCount,
        notificaciones: notificacionesDeleted.deletedCount
      }
    });
  } catch (err) {
    console.error("Error eliminando oficina:", err);
    res.status(500).json({ error: err.message });
  }
});

// Obtener detalles de una oficina específica
router.get("/oficinas/:id/detalle", isSuperAdmin, async (req, res) => {
  try {
    console.log("🔍 Obteniendo detalle de oficina:", req.params.id);
    
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: "Oficina no encontrada" });
    }

    const tenantIdNormalizado = normalizarTenantId(tenant.tenantId);
    
    const admins = await Admin.find({ tenantId: tenantIdNormalizado }).select('-password');
    const cobradores = await Cobrador.find({ tenantId: tenantIdNormalizado }).select('-password');
    const clientes = await Cliente.find({ tenantId: tenantIdNormalizado });
    const prestamos = await Prestamo.find({ tenantId: tenantIdNormalizado });

    // Calcular estadísticas de la oficina
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

// Ruta de prueba protegida para diagnosticos de superadmin
router.get("/test", isSuperAdmin, (req, res) => {
  res.json({ 
    mensaje: "Ruta de superadmin funcionando",
    user: req.user || null
  });
});

module.exports = router;
