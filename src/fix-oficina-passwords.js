const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixOficinaPasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
    console.log("=========================================");

    const Admin = require('./models/Admin');
    const Cobrador = require('./models/Cobrador');

    // Datos de la oficina problemática
    const tenantId = "oficina_test_final_3BwN";
    
    // LAS CONTRASEÑAS QUE DEBERÍAN FUNCIONAR (las que viste en el modal)
    const adminPassword = "NPPZ6vq6";
    const cobradorPassword = "OWp3og9R";

    // ===== 1. VERIFICAR ADMIN =====
    console.log("\n🔍 VERIFICANDO ADMIN...");
    const admin = await Admin.findOne({ tenantId });
    
    if (!admin) {
      console.log("❌ Admin no encontrado para tenant:", tenantId);
    } else {
      console.log("✅ Admin encontrado:", admin.email);
      console.log("   Hash en BD:", admin.password.substring(0, 30) + "...");
      
      // Verificar si la contraseña actual funciona
      const isValid = await bcrypt.compare(adminPassword, admin.password);
      console.log(`   ¿Contraseña "${adminPassword}" válida?`, isValid ? "✅ SI" : "❌ NO");
      
      if (!isValid) {
        console.log("\n⚠️ Contraseña incorrecta. Rehasheando...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);
        
        admin.password = hashedPassword;
        await admin.save();
        
        console.log("✅ Contraseña de admin actualizada");
        console.log("   Nuevo hash:", admin.password.substring(0, 30) + "...");
        
        // Verificar que funciona
        const verify = await bcrypt.compare(adminPassword, admin.password);
        console.log("   Verificación:", verify ? "✅ CORRECTA" : "❌ ERROR");
      }
    }

    // ===== 2. VERIFICAR COBRADOR =====
    console.log("\n🔍 VERIFICANDO COBRADOR...");
    const cobrador = await Cobrador.findOne({ tenantId });
    
    if (!cobrador) {
      console.log("❌ Cobrador no encontrado para tenant:", tenantId);
    } else {
      console.log("✅ Cobrador encontrado:", cobrador.email);
      console.log("   Hash en BD:", cobrador.password.substring(0, 30) + "...");
      
      // Verificar si la contraseña actual funciona
      const isValid = await bcrypt.compare(cobradorPassword, cobrador.password);
      console.log(`   ¿Contraseña "${cobradorPassword}" válida?`, isValid ? "✅ SI" : "❌ NO");
      
      if (!isValid) {
        console.log("\n⚠️ Contraseña incorrecta. Rehasheando...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cobradorPassword, salt);
        
        cobrador.password = hashedPassword;
        await cobrador.save();
        
        console.log("✅ Contraseña de cobrador actualizada");
        console.log("   Nuevo hash:", cobrador.password.substring(0, 30) + "...");
        
        // Verificar que funciona
        const verify = await bcrypt.compare(cobradorPassword, cobrador.password);
        console.log("   Verificación:", verify ? "✅ CORRECTA" : "❌ ERROR");
      }
    }

    console.log("\n=========================================");
    console.log("✅ PROCESO COMPLETADO");
    console.log("=========================================");
    console.log("Ahora puedes iniciar sesión con:");
    console.log("ADMIN:");
    console.log("   Email:", admin?.email || "No encontrado");
    console.log("   Password:", adminPassword);
    console.log("\nCOBRADOR:");
    console.log("   Email:", cobrador?.email || "No encontrado");
    console.log("   Password:", cobradorPassword);

    mongoose.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

fixOficinaPasswords();