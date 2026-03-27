const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function crearDatosPrueba() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;

    // 1. Crear o actualizar tenant (empresa)
    const tenantId = 'popayan2_1q4i';
    const tenant = await db.collection('tenants').findOne({ tenantId });
    
    if (!tenant) {
      await db.collection('tenants').insertOne({
        nombre: 'Popayan2',
        tenantId: tenantId,
        codigoEmpresa: 'EMP-TEST',
        estado: true,
        fechaCreacion: new Date()
      });
      console.log('✅ Tenant creado');
    }

    // 2. Crear admin
    const admin = await db.collection('admins').findOne({ email: 'admin@popayan2_1q4i.com' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      await db.collection('admins').insertOne({
        nombre: 'Administrador',
        email: 'admin@popayan2_1q4i.com',
        password: hashedPassword,
        rol: 'admin',
        tenantId: tenantId
      });
      console.log('✅ Admin creado');
    }

    // 3. Crear cobrador
    const cobrador = await db.collection('cobradors').findOne({ email: 'cobrador@popayan2_1q4i.com' });
    if (!cobrador) {
      const hashedPassword = await bcrypt.hash('Cobrador123!', 10);
      await db.collection('cobradors').insertOne({
        nombre: 'Cobrador Principal',
        email: 'cobrador@popayan2_1q4i.com',
        password: hashedPassword,
        cedula: '123456789',
        telefono: '3001234567',
        tenantId: tenantId,
        activo: true
      });
      console.log('✅ Cobrador creado');
    }

    // 4. Crear cliente
    const cliente = await db.collection('clientes').findOne({ cedula: '987654321' });
    if (!cliente) {
      await db.collection('clientes').insertOne({
        nombre: 'Cliente de Prueba',
        cedula: '987654321',
        telefono: '3007654321',
        direccion: 'Calle Principal 123',
        email: 'cliente@test.com',
        tenantId: tenantId,
        activo: true,
        createdAt: new Date()
      });
      console.log('✅ Cliente creado');
    }

    // 5. Crear préstamo
    const clienteObj = await db.collection('clientes').findOne({ cedula: '987654321' });
    const prestamo = await db.collection('prestamos').findOne({ clienteId: clienteObj._id });
    
    if (!prestamo && clienteObj) {
      await db.collection('prestamos').insertOne({
        clienteId: clienteObj._id,
        capital: 1000000,
        interes: 200000,
        total: 1200000,
        totalAPagar: 1200000,
        totalPagado: 0,
        plazo: 30,
        estado: 'activo',
        tenantId: tenantId,
        fechaInicio: new Date(),
        fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      console.log('✅ Préstamo creado');
    }

    console.log('\n🎉 Datos de prueba creados exitosamente!');
    console.log('\nCredenciales de prueba:');
    console.log('  Admin: admin@popayan2_1q4i.com / Admin123!');
    console.log('  Cobrador: cobrador@popayan2_1q4i.com / Cobrador123!');
    console.log('  Cliente: Cliente de Prueba / Cédula: 987654321');
    console.log('  Préstamo: $1,000,000 + $200,000 interés = $1,200,000');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

crearDatosPrueba();