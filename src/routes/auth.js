const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");
const Cobrador = require("../models/Cobrador");

// ===== LOGIN PARA ADMIN (CORREGIDO CON BÚSQUEDA CASE-INSENSITIVE) =====
router.post("/admin/login", async (req, res) => {
  try {
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
    console.log('🔴 FUNCIÓN DE LOGIN CORREGIDA');
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴');
    
    const emailInput = req.body.email ? req.body.email.trim() : null;
    const { password } = req.body;

    console.log("🔑 Email original recibido:", emailInput);
    console.log("🔑 Password recibido:", password);

    if (!emailInput || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    // BÚSQUEDA CASE-INSENSITIVE (no importa mayúsculas/minúsculas)
    console.log('🔍 Buscando con búsqueda insensible a mayúsculas...');
    const user = await Admin.findOne({ 
      email: { $regex: new RegExp(`^${emailInput}$`, 'i') } 
    }).lean();
    
    console.log('🔍 Resultado:', user ? '✅ Encontrado' : '❌ No encontrado');
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      
      // Mostrar todos los emails para depuración
      const todos = await Admin.find({}, 'email').lean();
      console.log('📋 Emails en DB:', todos.map(u => u.email));
      
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    console.log('✅ Usuario encontrado:', {
      email: user.email,
      rol: user.rol,
      tenantId: user.tenantId
    });

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    console.log('🔐 Contraseña válida?', validPassword);

    if (!validPassword) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    // Generar token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        rol: user.rol,
        tenantId: user.tenantId
      },
      process.env.JWT_SECRET || 'tu_secreto_temporal',
      { expiresIn: '7d' }
    );

    console.log('✅ Login exitoso');
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        nombre: user.nombre, 
        email: user.email, 
        rol: user.rol, 
        tenantId: user.tenantId 
      } 
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: "Error interno" });
  }
});

// ===== LOGIN PARA COBRADOR =====
router.post("/cobrador/login", async (req, res) => {
  try {
    const emailInput = req.body.email ? req.body.email.trim() : null;
    const { password } = req.body;

    console.log("👤 Cobrador login intent - Email:", emailInput);

    if (!emailInput || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    const cobrador = await Cobrador.findOne({ 
      email: { $regex: new RegExp(`^${emailInput}$`, 'i') } 
    }).lean();
    
    if (!cobrador) {
      console.log("❌ Cobrador no encontrado");
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const validPassword = await bcrypt.compare(password, cobrador.password);

    if (!validPassword) {
      console.log("❌ Contraseña incorrecta cobrador");
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (cobrador.estado?.toLowerCase() !== "activo") {
      return res.status(401).json({ error: "Cuenta de cobrador inactiva" });
    }

    const token = jwt.sign(
      {
        id: cobrador._id,
        email: cobrador.email,
        rol: "cobrador",
        tenantId: cobrador.tenantId,
        nombre: cobrador.nombre
      },
      process.env.JWT_SECRET || 'tu_secreto_temporal',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: cobrador._id,
        nombre: cobrador.nombre,
        email: cobrador.email,
        rol: "cobrador",
        tenantId: cobrador.tenantId,
        telefono: cobrador.telefono
      }
    });

  } catch (error) {
    console.error("❌ Error en login cobrador:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;