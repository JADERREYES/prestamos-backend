const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const Admin = require('./models/Admin');
    
    // Datos del admin de la nueva oficina
    const adminEmail = "admin@oficina-jamundi_Tcvu.com";
    const nuevaPassword = "NPPZ6vq6"; // La que te generó Super Admin
    
    // Buscar el admin
    const admin = await Admin.findOne({ email: adminEmail });
    
    if (!admin) {
      console.log("❌ Admin no encontrado");
      return;
    }
    
    console.log("📝 Admin encontrado:");
    console.log("  Email:", admin.email);
    console.log("  TenantId:", admin.tenantId);
    console.log("  Password actual (hash):", admin.password.substring(0, 30) + "...");
    
    // Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuevaPassword, salt);
    
    // Actualizar la contraseña
    admin.password = hashedPassword;
    await admin.save();
    
    console.log("\n✅ Contraseña actualizada correctamente");
    console.log("  Nueva password:", nuevaPassword);
    console.log("  Nuevo hash:", admin.password.substring(0, 30) + "...");
    
    // Verificar que funciona
    const verifyPassword = await bcrypt.compare(nuevaPassword, admin.password);
    console.log("  Verificación:", verifyPassword ? "✅ CORRECTA" : "❌ ERROR");
    
    mongoose.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

resetAdminPassword();