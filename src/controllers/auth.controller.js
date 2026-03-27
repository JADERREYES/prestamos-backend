const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin'); // O tu modelo de usuario

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // EL SECRETO: Meter el tenantId en el PAYLOAD del JWT
    const token = jwt.sign(
      { 
        id: admin._id, 
        rol: admin.rol, 
        tenantId: admin.tenantId // <--- CRUCIAL
      },
      process.env.JWT_SECRET || 'tu_secreto_temporal',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: admin._id,
        nombre: admin.nombre,
        email: admin.email,
        rol: admin.rol,
        tenantId: admin.tenantId // <--- ENVIAR AL FRONTEND
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
};