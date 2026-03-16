const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Sustituye por el modelo correcto si la ruta es distinta
const Admin = require('./src/models/Admin'); 

async function reset() {
    await mongoose.connect(process.env.MONGODB_URI);
    const passwordPlano = "123456";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(passwordPlano, salt);

    const email = "admin@cali_5WRU.com";
    
    // Actualizamos el usuario con el hash generado POR ESTA LIBRERÍA
    const resultado = await Admin.findOneAndUpdate(
        { email: email.toLowerCase() },
        { password: hash },
        { new: true }
    );

    if (resultado) {
        console.log("✅ Usuario actualizado con éxito");
        console.log("📧 Email:", email);
        console.log("🔑 Nuevo Hash:", hash);
    } else {
        console.log("❌ No se encontró el usuario en la DB");
    }
    process.exit();
}

reset();