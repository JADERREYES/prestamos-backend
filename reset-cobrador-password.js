const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetCobradorPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    // Nueva contraseña
    const newPassword = 'Admin123!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Resetear para todos los cobradores de cali22_b5j1
    const result = await db.collection('cobradors').updateMany(
      { tenantId: 'cali22_b5j1' },
      { $set: { password: hashedPassword } }
    );
    
    console.log(`✅ Contraseña actualizada para ${result.modifiedCount} cobradores`);
    console.log(`📧 Email: cobrador@cali22_b5j1.com`);
    console.log(`🔑 Nueva contraseña: ${newPassword}`);
    
    // Verificar
    const cobrador = await db.collection('cobradors').findOne({ 
      email: 'cobrador@cali22_b5j1.com' 
    });
    
    if (cobrador) {
      const isValid = await bcrypt.compare(newPassword, cobrador.password);
      console.log(`\n🔐 Verificación: ${isValid ? '✅ Correcta' : '❌ Incorrecta'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetCobradorPassword();