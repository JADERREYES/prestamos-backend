require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');
const Admin = require('./models/Admin');

async function resetSuperadminPassword() {
  const email = 'superadmin@gotaagota.com';
  const nuevaPassword = process.env.SUPERADMIN_NEW_PASSWORD;

  try {
    if (!nuevaPassword) {
      throw new Error('Define SUPERADMIN_NEW_PASSWORD antes de ejecutar el script');
    }

    dns.setServers(['8.8.8.8', '1.1.1.1']);

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('MongoDB conectado');

    const admin = await Admin.findOne({ email, rol: 'superadmin' });

    if (!admin) {
      throw new Error(`Superadmin no encontrado con email ${email} y rol superadmin`);
    }

    const hash = await bcrypt.hash(nuevaPassword, 10);

    await Admin.updateOne(
      { _id: admin._id },
      { $set: { password: hash } }
    );

    console.log('Password de superadmin actualizada correctamente');
    console.log('Email:', admin.email);
  } catch (error) {
    console.error('Error reseteando password de superadmin:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

resetSuperadminPassword();
