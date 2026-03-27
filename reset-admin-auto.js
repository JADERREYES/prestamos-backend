const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    const newPassword = 'Admin123!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Resetear solo el admin de cali22_b5j1
    const result = await db.collection('admins').updateOne(
      { email: 'admin@cali22_b5j1.com' },
      { $set: { password: hashedPassword } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Contraseña actualizada para admin@cali22_b5j1.com');
      console.log(`🔑 Nueva contraseña: ${newPassword}\n`);
    } else {
      console.log('⚠️ No se actualizó nada');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetAdmin();