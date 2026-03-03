const express = require('express');
const router = express.Router();
const Cobrador = require('../models/Cobrador');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const cobradores = await Cobrador.countDocuments({ estado: 'activo' });
    const clientes = await Cliente.countDocuments({ estado: 'activo' });
    const prestamos = await Prestamo.find().populate('cliente', 'nombre').populate('cobrador', 'nombre cedula');
    
    const carteraTotal = prestamos.reduce((sum, p) => sum + p.totalAPagar, 0);
    const totalRecaudado = prestamos.reduce((sum, p) => sum + p.totalPagado, 0);
    const porCobrar = carteraTotal - totalRecaudado;
    const prestamosActivos = prestamos.filter(p => p.estado === 'activo').length;

    const ultimosPrestamos = prestamos.slice(-10).reverse().map(p => ({
      _id: p._id,
      cliente: p.cliente?.nombre,
      cobrador: p.cobrador?.nombre,
      capital: p.capital,
      totalAPagar: p.totalAPagar,
      totalPagado: p.totalPagado,
      estado: p.estado,
      createdAt: p.createdAt
    }));

    const cobradoresRecientes = await Cobrador.find({ estado: 'activo' })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: { cobradores, clientes, carteraTotal, totalRecaudado, porCobrar, prestamosActivos },
      ultimosPrestamos,
      cobradoresRecientes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
