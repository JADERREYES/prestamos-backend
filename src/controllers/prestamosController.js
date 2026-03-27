// Obtener préstamos por cliente
exports.getByCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const prestamos = await Prestamo.find({ clienteId })
      .populate('clienteId', 'nombre cedula')
      .sort({ createdAt: -1 });
    
    res.json({
      ok: true,
      prestamos
    });
  } catch (error) {
    console.error('Error obteniendo préstamos por cliente:', error);
    res.status(500).json({
      ok: false,
      error: 'Error al obtener los préstamos'
    });
  }
};