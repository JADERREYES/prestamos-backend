// backend/test-conexion.js
const mongoose = require('mongoose');
require('dotenv').config();

async function verificarConexion() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // 1. Verificar tenant (oficina)
    const tenantId = 'manisalez_X_2a'; // Cambia por el que quieras verificar
    
    console.log('🔍 VERIFICANDO DATOS PARA TENANT:', tenantId);
    console.log('=======================================\n');
    
    // 2. Contar cobradores
    const cobradores = await db.collection('cobradors').countDocuments({ tenantId });
    console.log(`👥 Cobradores en tenant: ${cobradores}`);
    
    // 3. Contar clientes
    const clientes = await db.collection('clientes').countDocuments({ tenantId });
    console.log(`👤 Clientes en tenant: ${clientes}`);
    
    // 4. Contar préstamos
    const prestamos = await db.collection('prestamos').countDocuments({ tenantId });
    console.log(`💰 Préstamos en tenant: ${prestamos}`);
    
    // 5. Contar pagos
    const pagos = await db.collection('pagos').countDocuments({ tenantId });
    console.log(`💵 Pagos en tenant: ${pagos}`);
    
    // 6. Ver pagos recientes
    console.log('\n📋 ÚLTIMOS 5 PAGOS:');
    const ultimosPagos = await db.collection('pagos')
      .find({ tenantId })
      .sort({ fecha: -1 })
      .limit(5)
      .toArray();
    
    if (ultimosPagos.length === 0) {
      console.log('   No hay pagos registrados');
    } else {
      ultimosPagos.forEach((pago, i) => {
        console.log(`   ${i+1}. Monto: $${pago.monto} - Fecha: ${new Date(pago.fecha).toLocaleDateString()}`);
      });
    }
    
    // 7. Resumen de cartera
    const prestamosActivos = await db.collection('prestamos').find({ 
      tenantId, 
      estado: 'activo' 
    }).toArray();
    
    const totalPrestamos = prestamosActivos.length;
    const capitalTotal = prestamosActivos.reduce((sum, p) => sum + p.capital, 0);
    const totalPagado = prestamosActivos.reduce((sum, p) => sum + (p.totalPagado || 0), 0);
    const saldoPendiente = prestamosActivos.reduce((sum, p) => sum + (p.totalAPagar - (p.totalPagado || 0)), 0);
    
    console.log('\n📊 RESUMEN DE CARTERA:');
    console.log(`   Préstamos activos: ${totalPrestamos}`);
    console.log(`   Capital total: $${capitalTotal}`);
    console.log(`   Total pagado: $${totalPagado}`);
    console.log(`   Saldo pendiente: $${saldoPendiente}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado');
  }
}

verificarConexion();