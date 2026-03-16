// reset-final.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetFinal() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas\n');

    const db = mongoose.connection.db;
    const email = "admin@cali_5WRU.com";
    const newPassword = "H7kQ4pA9"; // ← El password que quieres usar

    console.log(`📧 Reseteando password para: ${email}`);
    console.log(`🔑 Nuevo password: ${newPassword}`);

    // Generar hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    console.log(`🔐 Hash generado: ${hashedPassword}`);

    // Actualizar
    const result = await db.collection('admins').updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✅ Contraseña actualizada exitosamente!');
      
      // Verificar que funciona
      const admin = await db.collection('admins').findOne({ email });
      const verify = await bcrypt.compare(newPassword, admin.password);
      console.log(`🔐 Verificación: ${verify ? '✅ CORRECTA' : '❌ FALLÓ'}`);
      
      if (verify) {
        console.log('\n🎉 AHORA SÍ PUEDES HACER LOGIN CON:');
        console.log('📧 Email:', email);
        console.log('🔑 Password:', newPassword);
      }
    } else {
      console.log('\n❌ No se encontró el admin con email:', email);
      
      // Listar admins disponibles
      const admins = await db.collection('admins').find({}).toArray();
      console.log('\n📋 Admins disponibles:');
      admins.forEach(a => console.log(`- ${a.email} (${a.rol})`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado de MongoDB');
  }
}

resetFinal();