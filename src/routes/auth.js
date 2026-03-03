const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');

router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const valid = await admin.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: admin._id, nombre: admin.nombre, email: admin.email, rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: admin._id, nombre: admin.nombre, email: admin.email, rol: 'admin' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cobrador login: usuario puede ser EMAIL o CEDULA
router.post('/cobrador/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    const cobrador = await Cobrador.findOne({ $or: [{ email: usuario }, { cedula: usuario }], estado: 'activo' });
    if (!cobrador) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const valid = await cobrador.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: cobrador._id, nombre: cobrador.nombre, cedula: cobrador.cedula, email: cobrador.email, rol: 'cobrador' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: cobrador._id, nombre: cobrador.nombre, cedula: cobrador.cedula, email: cobrador.email, rol: 'cobrador' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/setup', async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) return res.status(403).json({ error: 'Ya existe un admin' });
    const admin = new Admin(req.body);
    await admin.save();
    res.json({ message: 'Admin creado exitosamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
