require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const SUPERADMIN = {
  nombre: 'superadmin',
  email: 'superadmin@gotaagota.com',
  password: 'SuperAdmin123!',
  rol: 'superadmin',
  tenantId: null
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta definido');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });

  const email = SUPERADMIN.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(SUPERADMIN.password, 10);

  const existing = await Admin.findOne({ email });

  if (existing) {
    await Admin.updateOne(
      { _id: existing._id },
      {
        $set: {
          nombre: SUPERADMIN.nombre,
          rol: SUPERADMIN.rol,
          tenantId: SUPERADMIN.tenantId,
          password: passwordHash
        }
      }
    );

    const updated = await Admin.findById(existing._id);
    const ok = await bcrypt.compare(SUPERADMIN.password, updated.password);
    console.log('Superadmin actualizado');
    console.log(`email: ${updated.email}`);
    console.log(`rol: ${updated.rol}`);
    console.log(`tenantId: ${updated.tenantId}`);
    console.log(`passwordValidada: ${ok}`);
    return;
  }

  const admin = await Admin.create({
    nombre: SUPERADMIN.nombre,
    email,
    password: SUPERADMIN.password,
    rol: SUPERADMIN.rol,
    tenantId: SUPERADMIN.tenantId
  });

  const ok = await bcrypt.compare(SUPERADMIN.password, admin.password);
  console.log('Superadmin creado');
  console.log(`email: ${admin.email}`);
  console.log(`rol: ${admin.rol}`);
  console.log(`tenantId: ${admin.tenantId}`);
  console.log(`passwordValidada: ${ok}`);
};

main()
  .catch((error) => {
    console.error('Error restaurando superadmin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
