const mongoose = require('mongoose');
require('dotenv').config();

async function debugDatabase() {
  try {
    console.log("--- 🔍 INICIANDO DIAGNÓSTICO ---");
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection;
    console.log(`✅ Conectado a: ${db.host}`);
    console.log(`📊 Nombre de la Base de Datos: ${db.name}`);

    // 1. Listar todas las colecciones reales en la DB
    const collections = await db.db.listCollections().toArray();
    const names = collections.map(c => c.name);
    console.log("📂 Colecciones reales encontradas:", names);

    // 2. Verificar si existe la colección que Mongoose espera
    if (!names.includes('admins')) {
      console.log("⚠️ ALERTA: La colección 'admins' NO existe. Mongoose no encontrará los datos.");
    }

    // 3. Buscar datos crudos (sin usar el Modelo) para ver qué hay
    const rawAdmins = await db.db.collection('admins').find({}).toArray();
    console.log(`👥 Usuarios encontrados en la colección 'admins': ${rawAdmins.length}`);
    
    rawAdmins.forEach(u => {
      console.log(`   - Email: ${u.email} | Rol: ${u.rol} | Tenant: ${u.tenantId}`);
    });

    if (rawAdmins.length === 0) {
      console.log("💡 Sugerencia: Si Compass te muestra datos, revisa si están en otra colección o en otra base de datos (mira el nombre en el .env)");
    }

  } catch (error) {
    console.error("❌ Error de diagnóstico:", error);
  } finally {
    mongoose.disconnect();
    console.log("--- 🏁 FIN DEL DIAGNÓSTICO ---");
  }
}

debugDatabase();