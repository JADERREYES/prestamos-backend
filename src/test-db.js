const mongoose = require('mongoose');
require('dotenv').config();

async function testDB() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
    
    // Verificar colecciones
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📚 Colecciones disponibles:");
    collections.forEach(c => console.log("  -", c.name));
    
    // Verificar modelo Tenant
    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find();
    console.log(`🏢 Tenants encontrados: ${tenants.length}`);
    
    // Verificar modelo Admin
    const Admin = require('./models/Admin');
    const admins = await Admin.find();
    console.log(`👤 Admins encontrados: ${admins.length}`);
    
    // Buscar superadmin
    const superadmin = await Admin.findOne({ 
      $or: [
        { rol: 'superadmin' },
        { rol: 'superadministrador' }
      ]
    });
    
    if (superadmin) {
      console.log("✅ Super Admin encontrado:", superadmin.email);
      console.log("   Rol:", superadmin.rol);
      console.log("   TenantId:", superadmin.tenantId);
    } else {
      console.log("❌ No se encontró Super Admin");
    }
    
    mongoose.disconnect();
    console.log("👋 Desconectado");
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

testDB();