const express = require('express');
const router = express.Router();
const Prestamo = require('../models/Prestamo');
const Cliente = require('../models/Cliente');
const Cobrador = require('../models/Cobrador');
const Pago = require('../models/Pago');

router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    console.log(`📊 Dashboard para tenant: ${tenantId}`);
    
    // Obtener préstamos con populate de cliente
    const prestamos = await Prestamo.find({ tenantId })
      .populate('clienteId', 'nombre cedula telefono')
      .lean();
    
    // Obtener clientes y cobradores
    const clientes = await Cliente.find({ tenantId }).lean();
    const cobradores = await Cobrador.find({ tenantId }).lean();
    
    // Estadísticas
    const prestamosActivos = prestamos.filter(p => p.estado === 'activo').length;
    const prestamosPagados = prestamos.filter(p => p.estado === 'pagado').length;
    const prestamosVencidos = prestamos.filter(p => p.estado === 'vencido').length;
    
    const totalCartera = prestamos.reduce((sum, p) => sum + (p.totalAPagar || p.total || 0), 0);
    const totalRecaudado = prestamos.reduce((sum, p) => sum + (p.totalPagado || 0), 0);
    const interesGenerado = prestamos.reduce((sum, p) => sum + (p.interes || 0), 0);
    
    // Últimos 5 préstamos
    const ultimosPrestamos = await Prestamo.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('clienteId', 'nombre cedula telefono')
      .lean();
    
    // Procesar préstamos para la respuesta
    const ultimosPrestamosFormateados = ultimosPrestamos.map(p => ({
      _id: p._id,
      cliente: p.clienteId ? {
        _id: p.clienteId._id,
        nombre: p.clienteId.nombre,
        cedula: p.clienteId.cedula,
        telefono: p.clienteId.telefono
      } : null,
      clienteId: p.clienteId?._id,
      capital: p.capital,
      interes: p.interes,
      total: p.totalAPagar || p.total,
      estado: p.estado,
      fechaCreacion: p.createdAt,
      fechaVencimiento: p.fechaVencimiento
    }));
    
    // Cobradores recientes
    const cobradoresRecientes = await Cobrador.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    
    res.json({
      stats: {
        totalCartera,
        totalRecaudado,
        prestamosActivos,
        prestamosPagados,
        prestamosVencidos,
        totalClientes: clientes.length,
        totalCobradores: cobradores.length,
        totalPrestamos: prestamos.length,
        interesGenerado
      },
      ultimosPrestamos: ultimosPrestamosFormateados,
      cobradoresRecientes: cobradoresRecientes.map(c => ({
        _id: c._id,
        nombre: c.nombre,
        email: c.email,
        telefono: c.telefono,
        cedula: c.cedula
      }))
    });
    
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;