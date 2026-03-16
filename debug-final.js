// debug-final.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function debugFinal() {
  try {
    console.log('1️⃣ Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a DB:', mongoose.connection.name);

    const db = mongoose.connection.db;
    const email = "admin@cali_5WRU.com";
    const password = "123456";

    // Buscar el usuario DIRECTAMENTE en la colección
    console.log('\n2️⃣ Buscando usuario con email:', email);
    const usuario = await db.collection('admins').findOne({ email });
    
    if (!usuario) {
      console.log('❌ Usuario NO encontrado');
      
      // Listar TODOS los usuarios para ver qué emails existen
      console.log('\n📋 TODOS los usuarios en la DB:');
      const todos = await db.collection('admins').find({}).toArray();
      todos.forEach(u => {
        console.log(`   - Email: "${u.email}"`);
        console.log(`     Password hash: ${u.password.substring(0, 20)}...`);
      });
      return;
    }

    console.log('✅ Usuario ENCONTRADO:');
    console.log('   Email:', usuario.email);
    console.log('   Password hash:', usuario.password);
    console.log('   Rol:', usuario.rol);
    console.log('   TenantId:', usuario.tenantId);

    // Verificar la contraseña
    console.log('\n3️⃣ Verificando contraseña...');
    const valida = await bcrypt.compare(password, usuario.password);
    console.log('   Resultado:', valida ? '✅ CORRECTA' : '❌ INCORRECTA');

    if (!valida) {
      // Generar nuevo hash para comparar
      const salt = await bcrypt.genSalt(10);
      const nuevoHash = await bcrypt.hash(password, salt);
      console.log('\n4️⃣ Información de depuración:');
      console.log('   Hash en DB:', usuario.password);
      console.log('   Nuevo hash generado:', nuevoHash);
      console.log('   Coinciden?:', usuario.password === nuevoHash);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado');
  }
}

debugFinal();