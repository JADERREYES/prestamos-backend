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
  notas: { type: String, default: '' }
}, { timestamps: true });

// Calcular restante virtualmente
prestamoSchema.virtual('restante').get(function() {
  return this.totalAPagar - this.totalPagado;
});

prestamoSchema.virtual('porcentajePagado').get(function() {
  if (this.totalAPagar === 0) return 0;
  return Math.round((this.totalPagado / this.totalAPagar) * 100);
});

prestamoSchema.set('toJSON', { virtuals: true });
prestamoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Prestamo', prestamoSchema);
