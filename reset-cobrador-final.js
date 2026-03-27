// reset-cobrador-final.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cobradorSchema = new mongoose.Schema({
    tenantId: String,
    nombre: String,
    email: String,
    password: String,
    estado: String
}, { collection: 'cobradores', strict: false });

const Cobrador = mongoose.model('Cobrador', cobradorSchema);

async function resetearCobrador() {
    console.log('🔧 Iniciando reset de contraseña para cobrador@cali_5WRU.com\n');
    
    try {
        console.log('🔄 Conectando a MongoDB Atlas...');
        console.log('URI:', process.env.MONGODB_URI.replace(/:[^:@]*@/, ':****@'));
        
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            family: 4
        });
        console.log('✅ Conectado exitosamente\n');

        // Buscar el cobrador
        const cobrador = await Cobrador.findOne({ 
            email: 'cobrador@cali_5WRU.com' 
        });
        
        if (!cobrador) {
            console.log('❌ No se encontró el cobrador con email: cobrador@cali_5WRU.com');
            
            // Mostrar todos los cobradores disponibles
            console.log('\n📋 Buscando todos los cobradores...');
            const todos = await Cobrador.find({}, 'email tenantId');
            console.log('\n📋 Cobradores disponibles:');
            if (todos.length === 0) {
                console.log('   No hay cobradores registrados');
            } else {
                todos.forEach(c => {
                    console.log(`- ${c.email} | Tenant: ${c.tenantId || 'N/A'}`);
                });
            }
            return;
        }

        console.log('✅ Cobrador encontrado:');
        console.log(`   ID: ${cobrador._id}`);
        console.log(`   Email: ${cobrador.email}`);
        console.log(`   Tenant: ${cobrador.tenantId}`);
        console.log(`   Estado: ${cobrador.estado}`);

        // Nueva contraseña
        const nuevaPassword = '123456';
        const salt = await bcrypt.genSalt(10);
        const nuevoHash = await bcrypt.hash(nuevaPassword, salt);

        // Actualizar
        cobrador.password = nuevoHash;
        cobrador.updatedAt = new Date();
        await cobrador.save();

        console.log('\n✅ CONTRASEÑA ACTUALIZADA:');
        console.log(`   Email: ${cobrador.email}`);
        console.log(`   Contraseña: ${nuevaPassword}`);
        console.log(`   Tenant: ${cobrador.tenantId}`);

        // Verificar
        const verificacion = await bcrypt.compare(nuevaPassword, cobrador.password);
        console.log(`   Verificación: ${verificacion ? '✅ OK' : '❌ Error'}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('querySrv') || error.message.includes('ETIMEOUT')) {
            console.log('\n🔍 ERROR DE CONEXIÓN:');
            console.log('   Tu IP 179.19.161.127 debe estar en la whitelist de MongoDB Atlas');
            console.log('   1. Ve a https://cloud.mongodb.com');
            console.log('   2. Project > Network Access');
            console.log('   3. Add IP Address > Add Current IP Address');
            console.log('   4. Agrega: 179.19.161.127');
        } else if (error.message.includes('Authentication failed')) {
            console.log('\n🔐 ERROR DE AUTENTICACIÓN:');
            console.log('   Usuario/contraseña incorrectos en MONGODB_URI');
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Conexión cerrada');
    }
}

resetearCobrador();
