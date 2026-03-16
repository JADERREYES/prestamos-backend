const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixPasswordsForSure() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
    console.log("=========================================");

    const Admin = require('./models/Admin');
    const Cobrador = require('./models/Cobrador');

    // ===== 1. CORREGIR TODOS LOS ADMINS =====
    console.log("\n🔧 CORRIGIENDO ADMINS...");
    const admins = await Admin.find({});
    
    for (const admin of admins) {
      console.log(`\n👤 Procesando: ${admin.email}`);
      
      // Determinar qué contraseña poner según el email
      let newPassword = "123456"; // Por defecto
      
      if (admin.email.includes('oficina_test_final')) {
        newPassword = "NPPZ6vq6";
      } else if (admin.email.includes('barranquilla')) {
        newPassword = "NPPZ6vq6"; // La misma para todas las nuevas
      } else if (admin.email === 'admin@gotaagota.com') {
        newPassword = "123456";
      } else if (admin.email === 'superadmin@gotaagota.com') {
        newPassword = "123456";
      }
      
      console.log(`   Asignando password: ${newPassword}`);
      
      // Hashear la nueva contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Actualizar en BD
      admin.password = hashedPassword;
      await admin.save();
      
      // Verificar
      const verify = await bcrypt.compare(newPassword, admin.password);
      console.log(`   Verificación: ${verify ? '✅ OK' : '❌ ERROR'}`);
    }

    // ===== 2. CORREGIR TODOS LOS COBRADORES =====
    console.log("\n🔧 CORRIGIENDO COBRADORES...");
    const cobradores = await Cobrador.find({});
    
    for (const cobrador of cobradores) {
      console.log(`\n👥 Procesando: ${cobrador.email}`);
      
      let newPassword = "123456";
      
      if (cobrador.email.includes('oficina_test_final')) {
        newPassword = "OWp3og9R";
      } else if (cobrador.email.includes('barranquilla')) {
        newPassword = "OWp3og9R";
      }
      
      console.log(`   Asignando password: ${newPassword}`);
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      cobrador.password = hashedPassword;
      await cobrador.save();
      
      const verify = await bcrypt.compare(newPassword, cobrador.password);
      console.log(`   Verificación: ${verify ? '✅ OK' : '❌ ERROR'}`);
    }

    console.log("\n=========================================");
    console.log("✅ CONTRASEÑAS CORREGIDAS");
    console.log("=========================================");
    console.log("AHORA PUEDES INGRESAR CON:");
    console.log("\n📌 Oficina Test Final:");
    console.log("   Admin: admin@oficina_test_final_3BwN.com / NPPZ6vq6");
    console.log("   Cobrador: cobrador@oficina_test_final_3BwN.com / OWp3og9R");
    console.log("\n📌 Oficina Barranquilla:");
    console.log("   Admin: admin@barranquilla_e03t.com / NPPZ6vq6");
    console.log("\n📌 Oficina Principal:");
    console.log("   Admin: admin@gotaagota.com / 123456");
    console.log("   Super Admin: superadmin@gotaagota.com / 123456");

    mongoose.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

fixPasswordsForSure();