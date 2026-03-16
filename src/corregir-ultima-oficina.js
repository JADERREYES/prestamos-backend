const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function corregirUltimaOficina() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const Tenant = require('./models/Tenant');
    const Admin = require('./models/Admin');
    const Cobrador = require('./models/Cobrador');

    // Buscar la última oficina
    const ultimaOficina = await Tenant.findOne().sort({ fechaCreacion: -1 });
    
    if (!ultimaOficina) {
      console.log("❌ No hay oficinas");
      return;
    }

    console.log(`\n🏢 CORRIGIENDO OFICINA: ${ultimaOficina.nombre}`);
    console.log(`   TenantId: ${ultimaOficina.tenantId}`);

    // Credenciales que DEBERÍAN funcionar (las que viste en el modal)
    const adminPassword = "NPPZ6vq6";    // <--- CAMBIA ESTO por la que viste
    const cobradorPassword = "OWp3og9R"; // <--- CAMBIA ESTO por la que viste

    // CORREGIR ADMIN
    const admin = await Admin.findOne({ tenantId: ultimaOficina.tenantId });
    if (admin) {
      console.log(`\n👤 Admin encontrado: ${admin.email}`);
      
      // Hashear la contraseña correcta
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      admin.password = hashedPassword;
      await admin.save();
      
      console.log(`   ✅ Contraseña de admin actualizada a: ${adminPassword}`);
      
      // Verificar
      const verify = await bcrypt.compare(adminPassword, admin.password);
      console.log(`   Verificación: ${verify ? '✅ OK' : '❌ ERROR'}`);
    }

    // CORREGIR COBRADOR
    const cobrador = await Cobrador.findOne({ tenantId: ultimaOficina.tenantId });
    if (cobrador) {
      console.log(`\n👥 Cobrador encontrado: ${cobrador.email}`);
      
      // Hashear la contraseña correcta
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(cobradorPassword, salt);
      
      cobrador.password = hashedPassword;
      await cobrador.save();
      
      console.log(`   ✅ Contraseña de cobrador actualizada a: ${cobradorPassword}`);
      
      // Verificar
      const verify = await bcrypt.compare(cobradorPassword, cobrador.password);
      console.log(`   Verificación: ${verify ? '✅ OK' : '❌ ERROR'}`);
    }

    console.log("\n✅ OFICINA CORREGIDA");
    console.log("========================");
    console.log("Ahora puedes iniciar sesión con:");
    console.log(`ADMIN: ${admin?.email} / ${adminPassword}`);
    console.log(`COBRADOR: ${cobrador?.email} / ${cobradorPassword}`);

    mongoose.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

corregirUltimaOficina();