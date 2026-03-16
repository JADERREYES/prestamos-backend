// reset-urgente.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetUrgente() {
  try {
    console.log('🔌 Conectando a MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a la base de datos:', mongoose.connection.name);

    const db = mongoose.connection.db;
    const email = "admin@cali_5WRU.com"; // Mantenemos como está en la DB
    const nuevaPassword = "123456";

    // Buscar el usuario primero
    const usuario = await db.collection('admins').findOne({ email });
    
    if (!usuario) {
      console.log('❌ Usuario NO encontrado con email:', email);
      
      // Buscar todos los admins para depurar
      const todos = await db.collection('admins').find({}).toArray();
      console.log('📋 Admins disponibles en DB:');
      todos.forEach(u => console.log(`   - ${u.email}`));
      return;
    }

    console.log('✅ Usuario encontrado. ID:', usuario._id);
    console.log('📧 Email en DB:', usuario.email);
    console.log('🔑 Password actual (primeros 20 chars):', usuario.password.substring(0, 20));

    // Generar NUEVO hash
    const salt = await bcrypt.genSalt(10);
    const nuevoHash = await bcrypt.hash(nuevaPassword, salt);
    console.log('🔐 Nuevo hash generado:', nuevoHash);

    // Actualizar la contraseña
    const resultado = await db.collection('admins').updateOne(
      { email },
      { $set: { password: nuevoHash } }
    );

    if (resultado.modifiedCount > 0) {
      console.log('✅ Contraseña actualizada EXITOSAMENTE');
      
      // Verificar que funciona
      const usuarioActualizado = await db.collection('admins').findOne({ email });
      const verificado = await bcrypt.compare(nuevaPassword, usuarioActualizado.password);
      console.log('🔐 Verificación:', verificado ? '✅ CORRECTA' : '❌ FALLÓ');
      
      if (verificado) {
        console.log('\n🎉 AHORA SÍ DEBE FUNCIONAR:');
        console.log('📧 Email:', email);
        console.log('🔑 Password:', nuevaPassword);
      }
    } else {
      console.log('❌ No se pudo actualizar la contraseña');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado');
  }
}

resetUrgente();