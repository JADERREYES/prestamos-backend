const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Tenant = require("../models/Tenant");
const Admin = require("../models/Admin");
const Cobrador = require("../models/Cobrador");
const { 
  generarPassword, 
  generarTenant,
  generarEmailAdmin,
  generarEmailCobrador,
  generarCodigoEmpresa
} = require("../utils/generarCredenciales");

// Ruta para crear oficina (debe ser usada por superadmin)
router.post("/crear-oficina", async (req, res) => {
  try {
    const { nombre, direccion, telefono } = req.body;

    console.log("🏗 Creando oficina:", nombre);

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }

    // Generar tenantId usando TU función original
    const tenantId = generarTenant(nombre);
    
    // Verificar si ya existe
    const existe = await Tenant.findOne({ tenantId });
    if (existe) {
      return res.status(400).json({ error: "Ya existe una oficina con este nombre" });
    }

    // Generar código de empresa
    const codigoEmpresa = generarCodigoEmpresa();

    // Crear tenant (oficina)
    const tenant = new Tenant({
      nombre,
      direccion,
      telefono,
      tenantId,
      codigoEmpresa,
      estado: true,
      fechaCreacion: new Date()
    });

    await tenant.save();

    // Generar credenciales usando TU función original
    const adminPassword = generarPassword();
    const cobradorPassword = generarPassword();

    // Generar emails
    const adminEmail = generarEmailAdmin(tenantId).toLowerCase();
    const cobradorEmail = generarEmailCobrador(tenantId).toLowerCase();

    // Crear admin (la contraseña se hashea automáticamente por el modelo)
    const nuevoAdmin = new Admin({
      nombre: "Administrador",
      email: adminEmail,
      password: adminPassword, // ← SIN HASHEAR, el modelo lo hace
      rol: "admin",
      tenantId
    });
    await nuevoAdmin.save();

    // Crear cobrador principal
    const nuevoCobrador = new Cobrador({
      nombre: "Cobrador Principal",
      email: cobradorEmail,
      cedula: `TEMP-${Date.now()}`,
      telefono: telefono || "000000000",
      password: cobradorPassword, // ← SIN HASHEAR, el modelo lo hace
      tenantId
    });
    await nuevoCobrador.save();

    console.log("✅ Oficina creada correctamente");

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
        password: adminPassword // ← Se devuelve la contraseña original
      },
      cobrador: {
        email: cobradorEmail,
        password: cobradorPassword // ← Se devuelve la contraseña original
      }
    });

  } catch (error) {
    console.error("❌ Error creando oficina:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;