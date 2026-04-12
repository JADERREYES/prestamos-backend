const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');
const { signToken } = require('../utils/jwt');

// Ruta de login para todos los usuarios (superadmin, admin, cobrador)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Intento de login:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    
    // Buscar en Admin
    let user = await Admin.findOne({ email: email.toLowerCase() });
    let role = 'admin';
    
    // Si no está en Admin, buscar en Cobrador
    if (!user) {
      user = await Cobrador.findOne({ email: email.toLowerCase() });
      role = 'cobrador';
    }
    
    if (!user) {
      console.log('❌ Usuario no encontrado:', email);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('❌ Contraseña incorrecta para:', email);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Generar token JWT
    const token = signToken(
      { 
        id: user._id, 
        email: user.email, 
        rol: user.rol || role,
        tenantId: user.tenantId
      },
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login exitoso:', email, 'Rol:', user.rol || role);
    
    res.json({
      token,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol || role,
        tenantId: user.tenantId
      }
    });
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
