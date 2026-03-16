const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function crearAdminFaltante() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const Admin = require('./models/Admin');
    const Cobrador = require('./models/Cobrador');

    // Datos de la nueva oficina
    const tenantId = "oficina-jamundi_Tcvu";
    const adminEmail = "admin@oficina-jamundi_Tcvu.com";
    const adminPassword = "NPPZ6vq6"; // La contraseña que te generó Super Admin

    // Verificar si ya existe un admin
    const existeAdmin = await Admin.findOne({ email: adminEmail });
    
    if (existeAdmin) {
      console.log("✅ El admin ya existe:");
      console.log("  Email:", existeAdmin.email);
      console.log("  TenantId:", existeAdmin.tenantId);
    } else {
      console.log("📝 Creando admin para la oficina...");
      
      // Hashear la contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      const admin = new Admin({
        nombre: "Administrador",
        email: adminEmail,
        password: hashedPassword,
        rol: "admin",
        tenantId: tenantId
      });
      
      await admin.save();
      console.log("✅ Admin creado exitosamente:");
      console.log("  Email:", admin.email);
      console.log("  Password:", adminPassword);
      console.log("  TenantId:", admin.tenantId);
    }

    // Verificar el cobrador
    const cobrador = await Cobrador.findOne({ tenantId });
    
    console.log("\n👥 COBRADOR:");
    if (cobrador) {
      console.log("  Email:", cobrador.email);
      console.log("  TenantId:", cobrador.tenantId);
      console.log("  Estado:", cobrador.estado);
      
      // Verificar si la contraseña funciona
      const cobradorPassword = "OWp3og9R";
      const validPassword = await bcrypt.compare(cobradorPassword, cobrador.password);
      console.log(`  Contraseña válida: ${validPassword ? '✅ SI' : '❌ NO'}`);
      
      if (!validPassword) {
        console.log("⚠️ Rehasheando contraseña del cobrador...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cobradorPassword, salt);
        cobrador.password = hashedPassword;
        await cobrador.save();
        console.log("✅ Contraseña del cobrador rehasheada");
      }
    } else {
      console.log("❌ No se encontró cobrador para esta oficina");
    }

    // Verificar el tenant
    const Tenant = require('./models/Tenant');
    const tenant = await Tenant.findOne({ tenantId });
    
    console.log("\n🏢 OFICINA:");
    if (tenant) {
      console.log("  Nombre:", tenant.nombre);
      console.log("  TenantId:", tenant.tenantId);
      console.log("  Código:", tenant.codigoEmpresa);
    } else {
      console.log("❌ No se encontró la oficina");
    }

    mongoose.disconnect();
    console.log("\n✅ Proceso completado");
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

crearAdminFaltante();