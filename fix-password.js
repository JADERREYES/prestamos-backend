const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    // La contraseña correcta que te dio Super Admin
    const adminPassword = '24HEL8mb';
    const cobradorPassword = 'mDcjrGNS';
    
    // Hashear contraseñas
    const hashedAdmin = await bcrypt.hash(adminPassword, 10);
    const hashedCobrador = await bcrypt.hash(cobradorPassword, 10);
    
    // Actualizar admin
    const adminResult = await db.collection('admins').updateOne(
      { email: 'admin@popayan23_khpq.com' },
      { $set: { password: hashedAdmin } }
    );
    
    // Actualizar cobrador
    const cobradorResult = await db.collection('cobradors').updateOne(
      { email: 'cobrador@popayan23_khpq.com' },
      { $set: { password: hashedCobrador } }
    );
    
    console.log('🔑 CREDENCIALES ACTUALIZADAS:\n');
    console.log('👑 ADMINISTRADOR:');
    console.log(`   Email: admin@popayan23_khpq.com`);
    console.log(`   Contraseña: ${adminPassword}`);
    console.log(`   Estado: ${adminResult.modifiedCount > 0 ? '✅ Actualizada' : '⚠️ No cambió'}\n`);
    
    console.log('👥 COBRADOR:');
    console.log(`   Email: cobrador@popayan23_khpq.com`);
    console.log(`   Contraseña: ${cobradorPassword}`);
    console.log(`   Estado: ${cobradorResult.modifiedCount > 0 ? '✅ Actualizada' : '⚠️ No cambió'}\n`);
    
    // Verificar admin
    const admin = await db.collection('admins').findOne({ email: 'admin@popayan23_khpq.com' });
    if (admin) {
      const adminValid = await bcrypt.compare(adminPassword, admin.password);
      console.log(`🔐 Verificación Admin: ${adminValid ? '✅ Funciona' : '❌ No funciona'}`);
    } else {
      console.log('❌ Admin no encontrado, creándolo...');
      await db.collection('admins').insertOne({
        nombre: 'Administrador',
        email: 'admin@popayan23_khpq.com',
        password: hashedAdmin,
        rol: 'admin',
        tenantId: 'popayan23_khpq'
      });
      console.log('✅ Admin creado');
    }
    
    // Verificar cobrador
    const cobrador = await db.collection('cobradors').findOne({ email: 'cobrador@popayan23_khpq.com' });
    if (cobrador) {
      const cobradorValid = await bcrypt.compare(cobradorPassword, cobrador.password);
      console.log(`🔐 Verificación Cobrador: ${cobradorValid ? '✅ Funciona' : '❌ No funciona'}`);
    } else {
      console.log('❌ Cobrador no encontrado, creándolo...');
      await db.collection('cobradors').insertOne({
        nombre: 'Cobrador Principal',
        email: 'cobrador@popayan23_khpq.com',
        password: hashedCobrador,
        cedula: '123456789',
        telefono: '3001234567',
        tenantId: 'popayan23_khpq',
        activo: true
      });
      console.log('✅ Cobrador creado');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPassword();