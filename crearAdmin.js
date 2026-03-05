require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./src/models/Admin');

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {

  const hash = await bcrypt.hash('Admin123', 10);

  const result = await Admin.findOneAndUpdate(
    { _id: '69a79c1bf1d2684d8e461bad' },
    {
      email: 'admin@gotaagota.com',
      password: hash,
      rol: 'admin',
      nombre: 'Administrador'
    },
    { new: true }
  );

  console.log('✅ Admin actualizado - rol:', result.rol, '| email:', result.email);

  process.exit(0);

})
.catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});