const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 🔥 IMPORTANTE: AJUSTA ESTA RUTA SI TU MODELO ESTÁ EN OTRA CARPETA
const Cobrador = require('./models/Cobrador');

async function crearCobrador() {
  try {

    // 🔗 Conexión a Mongo
    await mongoose.connect('mongodb://127.0.0.1:27017/prestamos');

    console.log("✅ Conectado a MongoDB");

    // 🔑 Contraseña en texto plano
    const passwordPlano = "123456";

    // 🔐 Encriptar contraseña
    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    // 👤 Crear cobrador
    const nuevoCobrador = new Cobrador({
      tenantId: "buga_cbzl",
      nombre: "Cobrador Test",
      cedula: "123456789",
      email: "test@buga_cbzl.com",
      telefono: "3000000000",
      zona: "Centro",
      password: passwordHash,
      estado: "activo"
    });

    await nuevoCobrador.save();

    console.log("🔥 Cobrador creado correctamente");
    console.log("📧 Email: test@buga_cbzl.com");
    console.log("🔑 Password: 123456");

    process.exit();

  } catch (error) {

    console.error("❌ Error al crear cobrador:", error);

    process.exit(1);
  }
}

crearCobrador();