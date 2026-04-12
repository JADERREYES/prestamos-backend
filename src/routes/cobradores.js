const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { generarCodigoVinculacion } = require('../services/telegramCobrador.service');

// Middleware para verificar tenantId
router.use((req, res, next) => {
  if (!req.tenantId && req.user?.rol !== 'superadmin') {
    return res.status(400).json({ error: 'Tenant no definido' });
  }
  next();
});

// GET todos los cobradores (admin)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { search } = req.query;
    const tenantId = req.tenantId;

    const query = { tenantId };

    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { cedula: { $regex: search, $options: 'i' } },
        { telefono: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const cobradores = await Cobrador.find(query).select('-password');

    const cobradoresConStats = await Promise.all(
      cobradores.map(async (c) => {
        const clientes = await Cliente.countDocuments({
          cobrador: c._id,
          tenantId
        });

        const prestamos = await Prestamo.find({
          cobrador: c._id,
          estado: { $in: ['activo'] },
          tenantId
        });

        const cartera = prestamos.reduce(
          (sum, p) => sum + ((p.totalAPagar || 0) - (p.totalPagado || 0)),
          0
        );

        return {
          ...c.toObject(),
          clientesCount: clientes,
          cartera
        };
      })
    );

    res.json(cobradoresConStats);
  } catch (err) {
    console.error('❌ Error en GET /cobradores:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET cobrador por ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const cobrador = await Cobrador.findOne({
      _id: req.params.id,
      tenantId: req.tenantId
    }).select('-password');

    if (!cobrador) {
      return res.status(404).json({ error: 'Cobrador no encontrado' });
    }

    res.json(cobrador);
  } catch (err) {
    console.error('❌ Error en GET /cobradores/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST crear cobrador (admin)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const data = {
      ...req.body,
      tenantId: req.tenantId,
      email: req.body.email?.trim().toLowerCase(),
      cedula: req.body.cedula?.trim(),
      telefono: req.body.telefono?.trim(),
      nombre: req.body.nombre?.trim(),
      direccion: req.body.direccion?.trim() || '',
      zona: req.body.zona?.trim() || ''
    };

    if (!data.nombre || !data.email || !data.password || !data.cedula || !data.telefono) {
      return res.status(400).json({
        error: 'Nombre, email, contraseña, cédula y teléfono son obligatorios'
      });
    }

    const existe = await Cobrador.findOne({
      $or: [{ email: data.email }, { cedula: data.cedula }],
      tenantId: req.tenantId
    });

    if (existe) {
      return res.status(400).json({
        error: 'Ya existe un cobrador con ese email o cédula'
      });
    }

    // El modelo Cobrador ya hashea la contraseña en pre('save')
    const cobrador = new Cobrador(data);
    await cobrador.save();

    const codigoTelegram = await generarCodigoVinculacion({
      cobrador,
      creadoPor: req.user.id,
      creadoPorRol: req.user.rol
    });

    const { password, ...cobradorData } = cobrador.toObject();
    res.status(201).json({
      ...cobradorData,
      telegramVinculacion: {
        codigo: codigoTelegram.codigo,
        expiraEn: codigoTelegram.expiraEn,
        cobradorId: cobrador._id,
        tenantId: cobrador.tenantId
      }
    });
  } catch (err) {
    console.error('❌ Error en POST /cobradores:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT actualizar cobrador (admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      password,
      email,
      cedula,
      telefono,
      nombre,
      direccion,
      zona,
      activo
    } = req.body;

    const update = {};

    if (typeof nombre !== 'undefined') update.nombre = nombre.trim();
    if (typeof email !== 'undefined') update.email = email.trim().toLowerCase();
    if (typeof cedula !== 'undefined') update.cedula = cedula.trim();
    if (typeof telefono !== 'undefined') update.telefono = telefono.trim();
    if (typeof direccion !== 'undefined') update.direccion = direccion.trim();
    if (typeof zona !== 'undefined') update.zona = zona.trim();
    if (typeof activo !== 'undefined') update.activo = activo;

    if (update.email || update.cedula) {
      const existe = await Cobrador.findOne({
        _id: { $ne: req.params.id },
        tenantId: req.tenantId,
        $or: [
          ...(update.email ? [{ email: update.email }] : []),
          ...(update.cedula ? [{ cedula: update.cedula }] : [])
        ]
      });

      if (existe) {
        return res.status(400).json({
          error: 'Ya existe otro cobrador con ese email o cédula'
        });
      }
    }

    // findOneAndUpdate NO dispara pre('save'), por eso aquí sí se hashea manualmente
    if (password && password.trim()) {
      update.password = await bcrypt.hash(password.trim(), 10);
    }

    const cobrador = await Cobrador.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      update,
      { new: true }
    ).select('-password');

    if (!cobrador) {
      return res.status(404).json({ error: 'Cobrador no encontrado' });
    }

    res.json(cobrador);
  } catch (err) {
    console.error('❌ Error en PUT /cobradores/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE desactivar cobrador (admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cobrador = await Cobrador.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { activo: false },
      { new: true }
    ).select('-password');

    if (!cobrador) {
      return res.status(404).json({ error: 'Cobrador no encontrado' });
    }

    res.json({
      message: 'Cobrador desactivado correctamente',
      cobrador
    });
  } catch (err) {
    console.error('❌ Error en DELETE /cobradores/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
