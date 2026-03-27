const mongoose = require('mongoose');
require('dotenv').config();

async function verAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    // Obtener todos los admins
    const admins = await db.collection('admins').find({}).toArray();
    
    console.log('📋 LISTA DE ADMINISTRADORES:\n');
    admins.forEach(admin => {
      console.log(`   Email: ${admin.email}`);
      console.log(`   Tenant: ${admin.tenantId}`);
      console.log(`   Rol: ${admin.rol}`);
      console.log('   ---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verAdmins();