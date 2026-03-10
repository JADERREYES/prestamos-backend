const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');

/* =========================
   ADMIN LOGIN
========================= */

router.post('/admin/login', async (req, res) => {
  try {

    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    if (!admin)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await admin.comparePassword(password);

    if (!valid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    /* NUEVO: incluir tenantId en el token */

    const token = jwt.sign({
      id: admin._id,
      tenantId: admin.tenantId,  // NUEVO
      nombre: admin.nombre,
      email: admin.email,
      rol: 'admin'
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: admin._id,
        tenantId: admin.tenantId, // NUEVO
        nombre: admin.nombre,
        email: admin.email,
        rol: 'admin'
      }
    });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }
});


/* =========================
   COBRADOR LOGIN
========================= */

router.post('/cobrador/login', async (req, res) => {
  try {

    const { usuario, password } = req.body;

    const cobrador = await Cobrador.findOne({
      $or: [
        { email: usuario },
        { cedula: usuario }
      ],
      estado: 'activo'
    });

    if (!cobrador)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await cobrador.comparePassword(password);

    if (!valid)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    /* NUEVO: incluir tenantId */

    const token = jwt.sign({
      id: cobrador._id,
      tenantId: cobrador.tenantId, // NUEVO
      nombre: cobrador.nombre,
      cedula: cobrador.cedula,
      email: cobrador.email,
      rol: 'cobrador'
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: cobrador._id,
        tenantId: cobrador.tenantId, // NUEVO
        nombre: cobrador.nombre,
        cedula: cobrador.cedula,
        email: cobrador.email,
        rol: 'cobrador'
      }
    });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }
});


/* =========================
   ADMIN SETUP
========================= */

router.post('/admin/setup', async (req, res) => {

  try {

    const count = await Admin.countDocuments();

    if (count > 0)
      return res.status(403).json({ error: 'Ya existe un admin' });

    /* NUEVO: agregar tenantId al admin inicial */

    const admin = new Admin({
      ...req.body,
      tenantId: "oficina_principal"
    });

    await admin.save();

    res.json({ message: 'Admin creado exitosamente' });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


module.exports = router;