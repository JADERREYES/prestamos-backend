const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login para administradores
exports.adminLogin = async (req, res) => {
  try {
    // 1. Limpieza de datos (Evita errores de espacios o mayúsculas)
    const email = req.body.email ? req.body.email.toLowerCase().trim() : null;
    const { password } = req.body;

    console.log('🔐 Intento de login admin:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // 2. Buscar admin. 
    // IMPORTANTE: .lean() ayuda a obtener un objeto JS plano para evitar problemas de proxy
    const admin = await Admin.findOne({ email }).lean();

    if (!admin) {
      console.log('❌ Admin no encontrado en la DB:', email);
      // Imprime todos los emails en la consola para depurar (solo en desarrollo)
      const todos = await Admin.find({}, 'email');
      console.log('Emails existentes en DB:', todos.map(a => a.email));
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    console.log('✅ Admin encontrado:', {
      id: admin._id,
      email: admin.email,
      tenantId: admin.tenantId
    });

    // 3. Verificar contraseña
    // Asegúrate de que el password de la DB sea un hash válido de bcrypt
    const passwordValida = await bcrypt.compare(password, admin.password);
    
    if (!passwordValida) {
      console.log('❌ Password incorrecto para:', email);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // 4. Generar token JWT
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

    console.log('🚀 Login exitoso:', admin.email);

    // 5. Enviar respuesta
    res.json({
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
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Login para cobradores
exports.cobradorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Intento de login cobrador:', { email });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const cobrador = await Cobrador.findOne({ email });

    if (!cobrador) {
      console.log('❌ Cobrador no encontrado:', email);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const passwordValida = await bcrypt.compare(password, cobrador.password);

    if (!passwordValida) {
      console.log('❌ Password incorrecto para cobrador');
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      {
        id: cobrador._id,
        email: cobrador.email,
        rol: 'cobrador',
        tenantId: cobrador.tenantId
      },
      process.env.JWT_SECRET || 'tu_secreto_temporal',
      { expiresIn: '24h' }
    );

    console.log('✅ Login exitoso para cobrador:', cobrador.email);

    res.json({
      token,
      user: {
        id: cobrador._id,
        nombre: cobrador.nombre,
        email: cobrador.email,
        rol: 'cobrador',
        tenantId: cobrador.tenantId
      }
    });

  } catch (error) {
    console.error('❌ Error en login cobrador:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Verificar token (opcional - para mantener sesión)
exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_temporal');

    let user = null;

    if (decoded.rol === 'admin' || decoded.rol === 'superadmin') {
      user = await Admin.findById(decoded.id).select('-password');
    } else if (decoded.rol === 'cobrador') {
      user = await Cobrador.findById(decoded.id).select('-password');
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
};