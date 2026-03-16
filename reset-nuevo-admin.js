// reset-nuevo-admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const Admin = require('./src/models/Admin');

async function resetNuevoAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const email = "admin@medellin_6LAv.com"; // El email original con mayúsculas
    const newPassword = "Fy0kt_6F"; // La contraseña que te dieron
    
    console.log(`🔍 Buscando: ${email}`);
    const admin = await Admin.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });
    
    if (!admin) {
      console.log('❌ Admin no encontrado');
      return;
    }
    
    console.log('✅ Admin encontrado:', admin.email);
    
    // Cambiar password USANDO EL MODELO
    admin.password = newPassword;
    await admin.save();
    
    console.log('✅ Contraseña actualizada');
    
    // Verificar
    const verificado = await bcrypt.compare(newPassword, admin.password);
    console.log('🔐 Verificación:', verificado ? '✅ OK' : '❌ FALLO');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

resetNuevoAdmin();