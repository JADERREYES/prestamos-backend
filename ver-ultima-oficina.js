const mongoose = require('mongoose');
require('dotenv').config();

async function verUltimaOficina() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    // Obtener la última oficina creada
    const oficinas = await db.collection('tenants').find({}).sort({ fechaCreacion: -1 }).limit(1).toArray();
    const ultimaOficina = oficinas[0];
    
    if (ultimaOficina) {
      console.log('📋 ÚLTIMA OFICINA CREADA:');
      console.log(`   Nombre: ${ultimaOficina.nombre}`);
      console.log(`   Tenant ID: ${ultimaOficina.tenantId}`);
      console.log(`   Código: ${ultimaOficina.codigoEmpresa}\n`);
      
      // Buscar el admin de esta oficina
      const admin = await db.collection('admins').findOne({ tenantId: ultimaOficina.tenantId, rol: 'admin' });
      const cobrador = await db.collection('cobradors').findOne({ tenantId: ultimaOficina.tenantId });
      
      if (admin) {
        console.log('👑 ADMINISTRADOR:');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Contraseña: (la que generó Super Admin - revisa la terminal)`);
        console.log(`   Para resetear a Admin123! usa el script de abajo\n`);
      }
      
      if (cobrador) {
        console.log('👥 COBRADOR:');
        console.log(`   Email: ${cobrador.email}`);
        console.log(`   Contraseña: (la que generó Super Admin - revisa la terminal)`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verUltimaOficina();