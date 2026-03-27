const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function crearCobradoresFaltantes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;
    
    // Obtener todos los tenants
    const tenants = await db.collection('tenants').find({}).toArray();
    console.log(`📋 Encontrados ${tenants.length} tenants:\n`);
    
    for (const tenant of tenants) {
      const tenantId = tenant.tenantId;
      const emailCobrador = `cobrador@${tenantId}.com`;
      
      // Verificar si ya existe un cobrador para este tenant
      const cobradorExistente = await db.collection('cobradors').findOne({ 
        email: emailCobrador,
        tenantId: tenantId 
      });
      
      if (!cobradorExistente) {
        console.log(`📝 Creando cobrador para ${tenant.nombre} (${tenantId})`);
        
        // Crear cobrador
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        
        await db.collection('cobradors').insertOne({
          nombre: "Cobrador Principal",
          email: emailCobrador,
          password: hashedPassword,
          cedula: `TEMP-${Date.now()}-${tenantId}`,
          telefono: tenant.telefono || "000000000",
          tenantId: tenantId,
          activo: true,
          createdAt: new Date()
        });
        
        console.log(`✅ Cobrador creado: ${emailCobrador}\n`);
      } else {
        console.log(`✅ Cobrador ya existe para ${tenant.nombre}: ${emailCobrador}\n`);
      }
    }
    
    // Listar todos los cobradores
    console.log('📋 LISTA FINAL DE COBRADORES:');
    const cobradores = await db.collection('cobradors').find({}).toArray();
    cobradores.forEach(c => {
      console.log(`   - ${c.email} (${c.tenantId})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

crearCobradoresFaltantes();