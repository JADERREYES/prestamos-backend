const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function diagnosticarOfcinas() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
    console.log("=========================================");

    const Tenant = require('./models/Tenant');
    const Admin = require('./models/Admin');
    const Cobrador = require('./models/Cobrador');

    // 1. LISTAR TODAS LAS OFICINAS
    console.log("\n🏢 OFICINAS EN LA BD:");
    const tenants = await Tenant.find({});
    for (const tenant of tenants) {
      console.log(`\n📌 ${tenant.nombre} (${tenant.tenantId})`);
      console.log(`   Código: ${tenant.codigoEmpresa}`);
      
      // Buscar admin de esta oficina
      const admin = await Admin.findOne({ tenantId: tenant.tenantId });
      if (admin) {
        console.log(`   ✅ ADMIN: ${admin.email}`);
        
        // Probar contraseñas comunes
        const passwordsToTest = [
          "NPPZ6vq6",    // La de jamundi
          "OWp3og9R",    // La de cobrador jamundi
          "123456",      // Universal
          "admin123",    // Común
          "password"     // Común
        ];
        
        for (const testPwd of passwordsToTest) {
          const isValid = await bcrypt.compare(testPwd, admin.password);
          if (isValid) {
            console.log(`   🔑 Contraseña válida encontrada: "${testPwd}"`);
          }
        }
      } else {
        console.log(`   ❌ ADMIN: No tiene admin`);
      }
      
      // Buscar cobrador de esta oficina
      const cobrador = await Cobrador.findOne({ tenantId: tenant.tenantId });
      if (cobrador) {
        console.log(`   👥 COBRADOR: ${cobrador.email}`);
      } else {
        console.log(`   ❌ COBRADOR: No tiene cobrador`);
      }
    }

    // 2. VERIFICAR LA ÚLTIMA OFICINA CREADA
    console.log("\n=========================================");
    console.log("🔍 ÚLTIMA OFICINA CREADA:");
    const ultimaOficina = await Tenant.findOne().sort({ fechaCreacion: -1 });
    
    if (ultimaOficina) {
      console.log(`\n📌 ${ultimaOficina.nombre}`);
      console.log(`   TenantId: ${ultimaOficina.tenantId}`);
      
      const admin = await Admin.findOne({ tenantId: ultimaOficina.tenantId });
      if (admin) {
        console.log(`   Admin Email: ${admin.email}`);
        console.log(`   Admin Password Hash: ${admin.password.substring(0, 30)}...`);
        
        // Verificar si la contraseña "NPPZ6vq6" funciona
        const testPwd = "NPPZ6vq6";
        const isValid = await bcrypt.compare(testPwd, admin.password);
        console.log(`   ¿Contraseña "${testPwd}" válida? ${isValid ? '✅ SI' : '❌ NO'}`);
        
        // SI NO FUNCIONA, OFRECER CORREGIRLA
        if (!isValid) {
          console.log("\n⚠️ La contraseña NO es válida. ¿Corregirla? (Responde 'si' para corregir)");
          // En Node.js no podemos leer input fácilmente, así que mejor creamos otro script
        }
      }
    }

    console.log("\n=========================================");
    mongoose.disconnect();
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

diagnosticarOfcinas();