const mongoose = require('mongoose');
require('dotenv').config();

async function checkAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const Admin = require('./models/Admin');
    
    const admins = await Admin.find({});
    
    console.log(`📋 Total admins: ${admins.length}`);
    console.log("==================================");
    
    admins.forEach(admin => {
      console.log(`👤 Admin: ${admin.email}`);
      console.log(`   Rol: ${admin.rol}`);
      console.log(`   TenantId: ${admin.tenantId || 'NO TIENE'}`);
      console.log("----------------------------------");
    });
    
    // Verificar admin de oficina_principal
    const adminPrincipal = await Admin.findOne({ email: 'admin@gotaagota.com' });
    
    if (adminPrincipal && !adminPrincipal.tenantId) {
      console.log("\n⚠️ El admin principal no tiene tenantId. Actualizando...");
      
      adminPrincipal.tenantId = 'oficina_principal';
      await adminPrincipal.save();
      
      console.log("✅ Admin principal actualizado con tenantId: oficina_principal");
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

checkAdmins();