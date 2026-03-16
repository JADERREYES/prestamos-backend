// reset-password.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetAdminPassword() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    console.log('📦 URI:', process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas\n');

    const db = mongoose.connection.db;
    const email = "admin@cali_5WRU.com";
    const newPassword = "H7kQ4pA9";

    // Verificar que el admin existe
    console.log('🔍 Buscando admin:', email);
    const admin = await db.collection('admins').findOne({ email });
    
    if (!admin) {
      console.log('❌ Admin no encontrado');
      console.log('\n📋 Todos los admins en la DB:');
      const allAdmins = await db.collection('admins').find({}).toArray();
      allAdmins.forEach(a => console.log(`- ${a.email} (${a.rol})`));
      return;
    }

    console.log('✅ Admin encontrado:');
    console.log({
      email: admin.email,
      rol: admin.rol,
      tenantId: admin.tenantId
    });

    // Generar NUEVO hash para la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    console.log('\n🔐 Nuevo hash generado:', hashedPassword);

    // Actualizar la contraseña
    const result = await db.collection('admins').updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✅ Contraseña actualizada exitosamente!');
      
      // Verificar que funciona
      const updatedAdmin = await db.collection('admins').findOne({ email });
      const verifyPassword = await bcrypt.compare(newPassword, updatedAdmin.password);
      console.log('🔐 Verificación:', verifyPassword ? '✅ Correcta' : '❌ Incorrecta');
      
      if (verifyPassword) {
        console.log('\n🎉 Ahora puedes hacer login con:');
        console.log('📧 Email:', email);
        console.log('🔑 Password:', newPassword);
      }
    } else {
      console.log('❌ No se pudo actualizar la contraseña');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado de MongoDB');
  }
}

resetAdminPassword();