require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./src/models/Admin');

async function resetSuperadmin() {
  try {
    console.log('🔌 Conectando a MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ Conectado a la base de datos: ${mongoose.connection.name}`);

    const email = 'superadmin@gotaagota.com';
    const nuevaPassword = 'Admin12345';

    const admin = await Admin.findOne({ email });

    if (!admin) {
      console.log(`❌ Superadmin no encontrado con email: ${email}`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(nuevaPassword, 10);

    await Admin.updateOne(
      { _id: admin._id },
      {
        $set: {
          password: hash,
          rol: 'superadmin'
        }
      }
    );

    console.log('✅ Superadmin actualizado correctamente');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Nueva contraseña: ${nuevaPassword}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado');
  }
}

resetSuperadmin();