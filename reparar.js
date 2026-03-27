// backend/reparar.js
require('dotenv').config();
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  // Usamos el ID de Sol angela que me pasaste
  const solAngelaId = "69c1edc452997175a0c2c033"; 
  
  const res = await mongoose.connection.db.collection('prestamos').updateMany(
    {}, // A todos los préstamos
    { $set: { clienteId: new mongoose.Types.ObjectId(solAngelaId) } }
  );
  
  console.log(`✅ ${res.modifiedCount} préstamos vinculados a Sol angela`);
  process.exit(0);
}
fix();