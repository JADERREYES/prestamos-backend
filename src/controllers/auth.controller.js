const Admin = require('../models/Admin'); // O tu modelo de usuario
const { signToken } = require('../utils/jwt');

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // EL SECRETO: Meter el tenantId en el PAYLOAD del JWT
    const token = signToken(
      { 
        id: admin._id, 
        rol: admin.rol, 
        tenantId: admin.tenantId // <--- CRUCIAL
      },
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
