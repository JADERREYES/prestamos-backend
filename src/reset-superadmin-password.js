require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

async function resetSuperadminPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');

    const email = 'superadmin@gotaagota.com';
    const nuevaPassword = 'SuperAdmin123*';

    const admin = await Admin.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });

    if (!admin) {
      console.log('❌ Superadmin no encontrado');
      process.exit(1);
    }

    const hash = await bcrypt.hash(nuevaPassword, 10);

    admin.password = hash;
    await admin.save();

    console.log('✅ Contraseña actualizada correctamente');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Nueva contraseña:', nuevaPassword);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error reseteando contraseña:', error);
    process.exit(1);
  }
}

resetSuperadminPassword();