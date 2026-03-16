const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createCobradorTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const Cobrador = require('./models/Cobrador');
    
    // Buscar una oficina existente
    const Tenant = require('./models/Tenant');
    const oficina = await Tenant.findOne();
    
    if (!oficina) {
      console.log("❌ No hay oficinas creadas");
      return;
    }
    
    const password = "123456";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const cobrador = new Cobrador({
      nombre: "Cobrador Test",
      email: `cobrador@${oficina.tenantId}.com`,
      cedula: "123456789",
      telefono: "3001234567",
      password: hashedPassword,
      tenantId: oficina.tenantId
    });
    
    await cobrador.save();
    console.log("✅ Cobrador de prueba creado:");
    console.log(`   Email: cobrador@${oficina.tenantId}.com`);
    console.log("   Password: 123456");
    console.log("   TenantId:", oficina.tenantId);
    
    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

createCobradorTest();