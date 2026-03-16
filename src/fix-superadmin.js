const mongoose = require('mongoose');
require('dotenv').config();

async function fixSuperAdmin() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const Admin = require('./models/Admin');
    
    // Buscar superadmin
    const superadmin = await Admin.findOne({ 
      email: 'superadmin@gotaagota.com' 
    });
    
    if (!superadmin) {
      console.log("❌ No se encontró Super Admin");
      return;
    }
    
    console.log("📝 Super Admin actual:");
    console.log("  Email:", superadmin.email);
    console.log("  Rol:", superadmin.rol);
    console.log("  TenantId actual:", superadmin.tenantId);
    
    // Agregar campo tenantId si no existe
    if (superadmin.tenantId === undefined) {
      superadmin.tenantId = null;
      await superadmin.save();
      console.log("✅ Campo tenantId agregado y establecido a null");
    } else {
      console.log("ℹ️ El campo tenantId ya existe:", superadmin.tenantId);
    }
    
    // Verificar el cambio
    const verificado = await Admin.findOne({ email: 'superadmin@gotaagota.com' });
    console.log("📊 Verificación final:");
    console.log("  TenantId:", verificado.tenantId);
    
    mongoose.disconnect();
    console.log("👋 Desconectado");
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

fixSuperAdmin();