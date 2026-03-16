const mongoose = require('mongoose');

const prestamoSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  cobrador: { type: mongoose.Schema.Types.ObjectId, ref: 'Cobrador', required: true },
  capital: { type: Number, required: true },
  interes: { type: Number, required: true, default: 20 }, // porcentaje
  totalAPagar: { type: Number, required: true },
  totalPagado: { type: Number, default: 0 },
  numeroCuotas: { type: Number, required: true, default: 30 },
  frecuencia: { type: String, enum: ['diario', 'semanal', 'quincenal', 'mensual'], default: 'diario' },
  fechaInicio: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date },
  estado: { type: String, enum: ['activo', 'pagado', 'vencido', 'cancelado'], default: 'activo' },
  notas: { type: String, default: '' },
  tenantId: { type: String, required: true, index: true } // <--- AGREGADO PARA MULTITENANT
}, { timestamps: true });

// Calcular restante virtualmente
prestamoSchema.virtual('restante').get(function() {
  return this.totalAPagar - this.totalPagado;
});

prestamoSchema.virtual('porcentajePagado').get(function() {
  if (this.totalAPagar === 0) return 0;
  return Math.round((this.totalPagado / this.totalAPagar) * 100);
});

// Calcular totalAPagar antes de guardar si no se proporciona
prestamoSchema.pre('save', function(next) {
  if (!this.totalAPagar && this.capital && this.interes) {
    this.totalAPagar = this.capital * (1 + this.interes / 100);
  }
  
  // Calcular fecha de vencimiento si no existe
  if (!this.fechaVencimiento && this.fechaInicio && this.numeroCuotas) {
    const fecha = new Date(this.fechaInicio);
    switch(this.frecuencia) {
      case 'diario':
        fecha.setDate(fecha.getDate() + this.numeroCuotas);
        break;
      case 'semanal':
        fecha.setDate(fecha.getDate() + (this.numeroCuotas * 7));
        break;
      case 'quincenal':
        fecha.setDate(fecha.getDate() + (this.numeroCuotas * 15));
        break;
      case 'mensual':
        fecha.setMonth(fecha.getMonth() + this.numeroCuotas);
        break;
    }
    this.fechaVencimiento = fecha;
  }
  
  next();
});

prestamoSchema.set('toJSON', { virtuals: true });
prestamoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Prestamo', prestamoSchema);