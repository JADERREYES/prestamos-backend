const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
require('dotenv').config();

async function verificarPagosPendientes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const hoy = new Date();
    const empresas = await Tenant.find({ estado: true });
    
    const empresasMorosas = [];
    
    for (const empresa of empresas) {
      // Simular verificación de pago (en realidad deberías tener una colección de pagos)
      // Por ahora simulamos que algunas empresas no han pagado
      const fechaVencimiento = new Date(empresa.fechaCreacion);
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
      
      const diasDiferencia = Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24));
      
      if (diasDiferencia > 30) {
        empresasMorosas.push({
          id: empresa._id,
          nombre: empresa.nombre,
          fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
          diasAtraso: diasDiferencia - 30,
          contacto: `admin@${empresa.tenantId}.com`
        });
      }
    }
    
    console.log('Empresas con pagos pendientes:', empresasMorosas);
    return empresasMorosas;
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verificarPagosPendientes();