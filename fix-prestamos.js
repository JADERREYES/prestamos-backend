const mongoose = require('mongoose');
require('dotenv').config();

// Ruta correcta para los modelos
const Prestamo = require('./src/models/Prestamo');
const Pago = require('./src/models/Pago');

const redondear = (num) => {
  return Math.round(parseFloat(num || 0) * 100) / 100;
};

async function fixPrestamos() {
  try {
    console.log('\n🔍 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');
    
    // Obtener todos los préstamos
    const prestamos = await Prestamo.find();
    console.log(`📊 Encontrados ${prestamos.length} préstamos\n`);
    
    let actualizados = 0;
    
    for (const prestamo of prestamos) {
      let modificado = false;
      
      // Redondear valores
      const capital = redondear(prestamo.capital);
      const interes = redondear(prestamo.interes);
      const totalAPagar = redondear(prestamo.totalAPagar);
      let totalPagado = redondear(prestamo.totalPagado || 0);
      
      // Calcular saldo pendiente
      let saldoPendiente = redondear(totalAPagar - totalPagado);
      
      console.log(`\n📝 Préstamo ID: ${prestamo._id}`);
      console.log(`   Capital: ${prestamo.capital}`);
      console.log(`   Total a pagar: ${totalAPagar}`);
      console.log(`   Total pagado actual: ${totalPagado}`);
      console.log(`   Saldo pendiente: ${saldoPendiente}`);
      
      // CORREGIR: Si el saldo pendiente es menor a 1 peso (100 centavos) y mayor a 0
      if (saldoPendiente > 0 && saldoPendiente < 1) {
        console.log(`   ⚠️  Error de decimales detectado: ${saldoPendiente} pesos pendientes`);
        
        // Buscar el último pago para verificar
        const ultimoPago = await Pago.findOne({ 
          prestamoId: prestamo._id 
        }).sort({ fecha: -1 });
        
        if (ultimoPago) {
          console.log(`   📅 Último pago: ${ultimoPago.monto} pesos el ${ultimoPago.fecha}`);
        }
        
        // CORREGIR: Marcar como pagado y ajustar total pagado
        totalPagado = totalAPagar;
        prestamo.totalPagado = totalAPagar;
        prestamo.estado = 'pagado';
        modificado = true;
        
        console.log(`   ✅ CORREGIDO: Total pagado ajustado a ${totalAPagar}`);
        console.log(`   ✅ Estado cambiado a: PAGADO`);
      }
      
      // También corregir si hay decimales negativos
      if (saldoPendiente < 0 && saldoPendiente > -1) {
        console.log(`   ⚠️  Error negativo detectado: ${saldoPendiente}`);
        prestamo.totalPagado = totalAPagar;
        prestamo.estado = 'pagado';
        modificado = true;
        console.log(`   ✅ CORREGIDO: Total pagado ajustado a ${totalAPagar}`);
      }
      
      if (modificado) {
        await prestamo.save();
        actualizados++;
        console.log(`   💾 Préstamo guardado exitosamente`);
      } else {
        console.log(`   ✅ Préstamo correcto`);
      }
    }
    
    // Verificar nuevamente después de la corrección
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 RESUMEN:`);
    console.log(`   Préstamos procesados: ${prestamos.length}`);
    console.log(`   Préstamos corregidos: ${actualizados}`);
    console.log(`${'='.repeat(50)}\n`);
    
    // Mostrar el estado final
    const prestamosFinal = await Prestamo.find();
    console.log('📋 ESTADO FINAL DE PRÉSTAMOS:');
    for (const prestamo of prestamosFinal) {
      const saldo = redondear(prestamo.totalAPagar - prestamo.totalPagado);
      console.log(`   ${prestamo._id}: Pagado ${prestamo.totalPagado}/${prestamo.totalAPagar} - Saldo: ${saldo} - Estado: ${prestamo.estado}`);
    }
    
    console.log('\n🎉 Proceso completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPrestamos();