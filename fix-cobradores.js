const mongoose = require('mongoose');
require('dotenv').config();

async function fixCobradores() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    // 1. Obtener todos los cobradores
    const cobradores = await db.collection('cobradors').find({}).toArray();
    console.log('📋 COBRADORES ENCONTRADOS:');
    cobradores.forEach(c => {
      console.log(`   - ${c.email} (ID: ${c._id}, Tenant: ${c.tenantId})`);
    });
    
    // 2. Para cada cobrador, asignar sus clientes
    for (const cobrador of cobradores) {
      const tenantId = cobrador.tenantId;
      const cobradorId = cobrador._id;
      
      console.log(`\n🔧 Procesando cobrador: ${cobrador.email}`);
      console.log(`   Tenant: ${tenantId}`);
      console.log(`   ID: ${cobradorId}`);
      
      // Asignar clientes de este tenant a este cobrador
      const result = await db.collection('clientes').updateMany(
        { tenantId: tenantId, cobrador: { $exists: false } },
        { $set: { cobrador: cobradorId } }
      );
      
      console.log(`   ✅ ${result.modifiedCount} clientes asignados a este cobrador`);
    }
    
    // 3. Verificar resultado final
    console.log('\n📊 RESUMEN FINAL:');
    const clientesSinCobrador = await db.collection('clientes').countDocuments({ cobrador: { $exists: false } });
    console.log(`   Clientes sin cobrador: ${clientesSinCobrador}`);
    
    const clientesConCobrador = await db.collection('clientes').countDocuments({ cobrador: { $exists: true } });
    console.log(`   Clientes con cobrador: ${clientesConCobrador}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCobradores();