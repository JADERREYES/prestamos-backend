const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function regularizarEmpresa1() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");
    console.log("==================================");
    console.log("🏢 REGULARIZANDO EMPRESA 1");
    console.log("==================================");

    const Tenant = require('./models/Tenant');
    const Admin = require('./models/Admin');
    const Cobrador = require('./models/Cobrador');
    const Cliente = require('./models/Cliente');
    const Prestamo = require('./models/Prestamo');

    const tenantId = "oficina_principal";

    // ===== 1. VERIFICAR TENANT =====
    let tenant = await Tenant.findOne({ tenantId });
    
    if (!tenant) {
      console.log("📌 Creando tenant...");
      tenant = new Tenant({
        nombre: "Oficina Principal",
        direccion: "Dirección principal",
        telefono: "000000000",
        tenantId: tenantId,
        codigoEmpresa: "EMP001",
        estado: true,
        fechaCreacion: new Date()
      });
      await tenant.save();
      console.log("✅ Tenant creado");
    } else {
      console.log("✅ Tenant existe:", tenant.nombre);
    }

    // ===== 2. VERIFICAR ADMIN =====
    let admin = await Admin.findOne({ email: "admin@gotaagota.com" });
    
    if (!admin) {
      console.log("📌 Creando admin...");
      const password = "123456";
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      admin = new Admin({
        nombre: "Administrador",
        email: "admin@gotaagota.com",
        password: hashedPassword,
        rol: "admin",
        tenantId: tenantId
      });
      await admin.save();
      console.log("✅ Admin creado");
    } else {
      console.log("✅ Admin existe:", admin.email);
      // Asegurar que tenga tenantId
      if (!admin.tenantId) {
        admin.tenantId = tenantId;
        await admin.save();
        console.log("✅ TenantId asignado al admin");
      }
    }

    // ===== 3. CREAR COBRADOR (EL QUE FALTA) =====
    let cobrador = await Cobrador.findOne({ tenantId });
    
    if (!cobrador) {
      console.log("📌 Creando cobrador principal...");
      const password = "123456";
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      cobrador = new Cobrador({
        nombre: "Cobrador Principal",
        email: "cobrador@oficina_principal.com",
        cedula: `COB-${Date.now()}`,
        telefono: "3001112233",
        password: hashedPassword,
        tenantId: tenantId,
        estado: "activo",
        zona: "Todas"
      });
      await cobrador.save();
      console.log("✅ Cobrador creado:");
      console.log("   Email: cobrador@oficina_principal.com");
      console.log("   Password: 123456");
    } else {
      console.log("✅ Cobrador ya existe:", cobrador.email);
    }

    // ===== 4. VERIFICAR CLIENTES =====
    const totalClientes = await Cliente.countDocuments({ tenantId });
    console.log(`📊 Clientes en empresa: ${totalClientes}`);

    // ===== 5. VERIFICAR PRÉSTAMOS =====
    const totalPrestamos = await Prestamo.countDocuments({ tenantId });
    console.log(`📊 Préstamos en empresa: ${totalPrestamos}`);

    // ===== 6. ASIGNAR COBRADOR A CLIENTES EXISTENTES =====
    if (cobrador) {
      const clientesSinCobrador = await Cliente.updateMany(
        { tenantId, cobradorId: { $exists: false } },
        { $set: { cobradorId: cobrador._id } }
      );
      console.log(`📌 Clientes actualizados con cobrador: ${clientesSinCobrador.modifiedCount}`);
    }

    // ===== 7. RESUMEN FINAL =====
    console.log("\n==================================");
    console.log("📋 RESUMEN EMPRESA 1");
    console.log("==================================");
    console.log("🏢 Tenant:", tenant.nombre);
    console.log("🆔 Tenant ID:", tenant.tenantId);
    console.log("👤 Admin:", admin.email);
    console.log("👥 Cobrador:", cobrador ? cobrador.email : "NO CREADO");
    console.log(`👥 Clientes: ${totalClientes}`);
    console.log(`💰 Préstamos: ${totalPrestamos}`);
    console.log("\n✅ CREDENCIALES DE ACCESO:");
    console.log("==================================");
    console.log("PANEL ADMIN (http://localhost:3001):");
    console.log("   Email: admin@gotaagota.com");
    console.log("   Password: 123456");
    console.log("\nPANEL COBRADOR (http://localhost:3002):");
    console.log("   Email: cobrador@oficina_principal.com");
    console.log("   Password: 123456");
    console.log("\nPANEL SUPER ADMIN (http://localhost:5173):");
    console.log("   Email: superadmin@gotaagota.com");
    console.log("   Password: 123456");

    mongoose.disconnect();
    console.log("\n👋 Desconectado de MongoDB");
    
  } catch (error) {
    console.error("❌ Error:", error);
    mongoose.disconnect();
  }
}

regularizarEmpresa1();