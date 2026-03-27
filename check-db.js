require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Listar colecciones
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📂 Colecciones disponibles:", collections.map(c => c.name));

    // Ver admins
    const adminCollection = mongoose.connection.db.collection('admins');
    const admins = await adminCollection.find({}, { projection: { email: 1, tenantId: 1, rol: 1, nombre: 1 } }).toArray();

    console.log("\n👥 Administradores encontrados:");
    console.table(admins);

    // Ver tenants
    const tenantCollection = mongoose.connection.db.collection('tenants');
    const tenants = await tenantCollection.find({}, { projection: { nombre: 1, tenantId: 1, codigoEmpresa: 1 } }).toArray();

    console.log("\n🏢 Empresas (Tenants):");
    console.table(tenants);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

check();