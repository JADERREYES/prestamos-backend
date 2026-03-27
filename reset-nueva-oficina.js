const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetNuevaOficina() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    // Obtener la última oficina
    const oficinas = await db.collection('tenants').find({}).sort({ fechaCreacion: -1 }).limit(1).toArray();
    const oficina = oficinas[0];
    
    if (!oficina) {
      console.log('❌ No hay oficinas');
      process.exit(1);
    }
    
    const tenantId = oficina.tenantId;
    const newPassword = 'Admin123!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log(`📋 OFICINA: ${oficina.nombre} (${tenantId})\n`);
    
    // Resetear admin
    const adminResult = await db.collection('admins').updateOne(
      { tenantId: tenantId, rol: 'admin' },
      { $set: { password: hashedPassword } }
    );
    
    // Resetear cobrador
    const cobradorResult = await db.collection('cobradors').updateOne(
      { tenantId: tenantId },
      { $set: { password: hashedPassword } }
    );
    
    // Mostrar admin
    const admin = await db.collection('admins').findOne({ tenantId: tenantId, rol: 'admin' });
    if (admin) {
      console.log('👑 FRONTEND-ADMIN (http://localhost:3000):');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Contraseña: ${newPassword}\n`);
    }
    
    // Mostrar cobrador
    const cobrador = await db.collection('cobradors').findOne({ tenantId: tenantId });
    if (cobrador) {
      console.log('👥 FRONTEND-COBRADOR (http://localhost:3001):');
      console.log(`   Email: ${cobrador.email}`);
      console.log(`   Contraseña: ${newPassword}\n`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetNuevaOficina();