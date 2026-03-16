const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixAllPasswordsNow() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
    console.log("=========================================");

    const Admin = require('./models/Admin');
    const Cobrador = require('./models/Cobrador');

    // ===== 1. LISTAR TODOS LOS ADMINS CON SUS CONTRASEÑAS ACTUALES =====
    console.log("\n📋 ADMINS EN LA BD:");
    const admins = await Admin.find({});
    
    for (const admin of admins) {
      console.log(`\n👤 Admin: ${admin.email}`);
      console.log(`   TenantId: ${admin.tenantId}`);
      console.log(`   Rol: ${admin.rol}`);
      console.log(`   Hash actual: ${admin.password.substring(0, 30)}...`);
      
      // Si es de las oficinas problemáticas, resetear contraseña
      if (admin.email.includes('oficina_test_final') || admin.email.includes('barranquilla')) {
        console.log(`   ⚠️ RESETEANDO CONTRASEÑA PARA: ${admin.email}`);
        
        // Usar la contraseña que debería funcionar
        const newPassword = "123456"; // TEMPORAL para prueba
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        admin.password = hashedPassword;
        await admin.save();
        
        console.log(`   ✅ Nueva contraseña: ${newPassword}`);
        console.log(`   Nuevo hash: ${admin.password.substring(0, 30)}...`);
      }
    }

    // ===== 2. LISTAR TODOS LOS COBRADORES =====
    console.log("\n📋 COBRADORES EN LA BD:");
    const cobradores = await Cobrador.find({});
    
    for (const cobrador of cobradores) {
      console.log(`\n👤 Cobrador: ${cobrador.email}`);
      console.log(`   TenantId: ${cobrador.tenantId}`);
      
      // Si es de las oficinas problemáticas, resetear contraseña
      if (cobrador.email.includes('oficina_test_final') || cobrador.email.includes('barranquilla')) {
        console.log(`   ⚠️ RESETEANDO CONTRASEÑA PARA: ${cobrador.email}`);
        
        const newPassword = "123456"; // TEMPORAL para prueba
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        cobrador.password = hashedPassword;
        await cobrador.save();
        
        console.log(`   ✅ Nueva contraseña: ${newPassword}`);
      }
    }

    console.log("\n=========================================");
    console.log("✅ CONTRASEÑAS ACTUALIZADAS");
    console.log("=========================================");
    console.log("Ahora puedes iniciar sesión con:");
    console.log("Email: admin@oficina_test_final_3BwN.com");
    console.log("Password: 123456");
    console.log("\nEmail: admin@barranquilla_e03t.com");
    console.log("Password: 123456");
    console.log("\nEmail: cobrador@oficina_test_final_3BwN.com");
    console.log("Password: 123456");

    mongoose.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

fixAllPasswordsNow();