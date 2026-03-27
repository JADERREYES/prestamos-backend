const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// =========================
// LOGIN ADMIN
// =========================
exports.adminLogin = async (req, res) => {
  try {
    console.log('========== LOGIN ADMIN ==========');
    console.log('📥 Body recibido:', req.body);

    const email = req.body?.email ? String(req.body.email).trim() : null;
    const password = req.body?.password ? String(req.body.password).trim() : null;

    if (!email || !password) {
      console.log("❌ Faltan credenciales admin");
      return res.status(400).json({ 
        ok: false,
        error: 'Email y contraseña son requeridos' 
      });
    }

    console.log('🔍 Buscando admin con email:', email);
    
    const admin = await Admin.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });

    if (!admin) {
      console.log('❌ Admin no encontrado:', email);
      return res.status(401).json({ 
        ok: false,
        error: 'Credenciales incorrectas' 
      });
    }

    console.log('✅ Admin encontrado:', admin.email);
    console.log('🔐 Verificando contraseña...');
    
    const passwordValida = await bcrypt.compare(password, admin.password);

    if (!passwordValida) {
      console.log('❌ Password incorrecto para admin');
      return res.status(401).json({ 
        ok: false,
        error: 'Credenciales incorrectas' 
      });
    }

    console.log('✅ Contraseña válida');
    console.log('🪙 Generando token...');

    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        rol: admin.rol,
        tenantId: admin.tenantId
      },
      process.env.JWT_SECRET || 'tu_secreto_temporal',
      { expiresIn: '24h' }
    );

    console.log('✅ Login admin exitoso');
    
    res.json({
      ok: true,
      token,
      user: {
        id: admin._id,
        nombre: admin.nombre,
        email: admin.email,
        rol: admin.rol,
        tenantId: admin.tenantId
      }
    });

  } catch (error) {
    console.error('❌ Error CRÍTICO en login admin:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      ok: false,
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
};

// =========================
// LOGIN COBRADOR
// =========================
exports.cobradorLogin = async (req, res) => {
  try {
    console.log('========== LOGIN COBRADOR ==========');
    console.log('📥 Body recibido:', req.body);

    const email = req.body?.email ? String(req.body.email).trim() : null;
    const password = req.body?.password ? String(req.body.password).trim() : null;

    if (!email || !password) {
      console.log("❌ Faltan credenciales cobrador");
      return res.status(400).json({
        ok: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    // Detectar tenant
    let tenantDetectado = null;
    if (email.includes('@')) {
      const dominio = email.split('@')[1];
      tenantDetectado = dominio.split('.')[0];
    }

    console.log("🏢 Tenant detectado:", tenantDetectado);
    console.log('🔍 Buscando cobrador con email:', email);

    const query = tenantDetectado 
      ? { tenantId: tenantDetectado, email: { $regex: new RegExp(`^${email}$`, 'i') } }
      : { email: { $regex: new RegExp(`^${email}$`, 'i') } };

    const cobrador = await Cobrador.findOne(query);

    if (!cobrador) {
      console.log('❌ Cobrador no encontrado');
      return res.status(401).json({
        ok: false,
        error: 'Credenciales incorrectas'
      });
    }

    console.log('✅ Cobrador encontrado:', cobrador.email);
    console.log('🔐 Verificando contraseña...');

    const passwordValida = await bcrypt.compare(password, cobrador.password);

    if (!passwordValida) {
      console.log('❌ Password incorrecto para cobrador');
      return res.status(401).json({
        ok: false,
        error: 'Credenciales incorrectas'
      });
    }

    console.log('✅ Contraseña válida');

    if (cobrador.estado?.toLowerCase() !== 'activo') {
      console.log('❌ Cobrador inactivo');
      return res.status(401).json({
        ok: false,
        error: 'Cuenta de cobrador inactiva'
      });
    }

    console.log('🪙 Generando token...');

    const token = jwt.sign(
      {
        id: cobrador._id,
        email: cobrador.email,
        rol: 'cobrador',
        tenantId: cobrador.tenantId,
        nombre: cobrador.nombre
      },
      process.env.JWT_SECRET || 'tu_secreto_temporal',
      { expiresIn: '24h' }
    );

    console.log('✅ Login cobrador exitoso');

    res.json({
      ok: true,
      token,
      user: {
        id: cobrador._id,
        nombre: cobrador.nombre,
        email: cobrador.email,
        rol: 'cobrador',
        tenantId: cobrador.tenantId,
        telefono: cobrador.telefono,
        zona: cobrador.zona
      }
    });

  } catch (error) {
    console.error('❌ Error en login cobrador:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      ok: false,
      error: 'Error en el servidor',
      details: error.message 
    });
  }
};

// =========================
// CREAR COBRADOR
// =========================
exports.crearCobrador = async (req, res) => {
  try {
    console.log("📥 Crear cobrador:", req.body);

    const {
      tenantId,
      nombre,
      cedula,
      email,
      telefono,
      zona,
      password
    } = req.body;

    if (!tenantId || !nombre || !cedula || !email || !telefono || !password) {
      return res.status(400).json({
        ok: false,
        error: "Todos los campos son obligatorios"
      });
    }

    // Validar duplicados
    const existe = await Cobrador.findOne({
      $or: [{ email }, { cedula }]
    });

    if (existe) {
      return res.status(400).json({
        ok: false,
        error: "El cobrador ya existe con ese email o cédula"
      });
    }

    // Crear nuevo cobrador (el modelo encriptará la password automáticamente)
    const nuevo = new Cobrador({
      tenantId: tenantId.toLowerCase().trim(),
      nombre: nombre.trim(),
      cedula: cedula.trim(),
      email: email.toLowerCase().trim(),
      telefono: telefono.trim(),
      zona: zona ? zona.trim() : '',
      password: password,
      estado: "activo"
    });

    await nuevo.save();

    console.log("✅ Cobrador creado:", email);

    res.json({
      ok: true,
      mensaje: "Cobrador creado correctamente",
      cobrador: {
        id: nuevo._id,
        nombre: nuevo.nombre,
        email: nuevo.email,
        tenantId: nuevo.tenantId
      }
    });

  } catch (error) {
    console.error("❌ Error creando cobrador:", error);
    res.status(500).json({
      ok: false,
      error: "Error del servidor",
      details: error.message
    });
  }
};

// =========================
// VERIFY TOKEN
// =========================
exports.verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      return res.status(401).json({ 
        ok: false,
        error: 'Token no proporcionado' 
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'tu_secreto_temporal'
    );

    let user = null;

    if (decoded.rol === 'cobrador') {
      user = await Cobrador.findById(decoded.id).select('-password');
    } else {
      user = await Admin.findById(decoded.id).select('-password');
    }

    if (!user) {
      return res.status(401).json({ 
        ok: false,
        error: 'Usuario no encontrado' 
      });
    }

    res.json({ 
      ok: true,
      user 
    });

  } catch (error) {
    console.error('❌ Error verificando token:', error);
    res.status(401).json({ 
      ok: false,
      error: 'Token inválido' 
    });
  }
};

// =========================
// LOGOUT
// =========================
exports.logout = async (req, res) => {
  res.json({ ok: true });
};