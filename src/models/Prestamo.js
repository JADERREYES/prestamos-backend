const mongoose = require('mongoose');

const prestamoSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true,
    index: true
  },
  capital: {
    type: Number,
    required: true,
    min: 0
  },
  interes: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true
  },
  totalAPagar: {
    type: Number,
    required: true
  },
  totalPagado: {
    type: Number,
    default: 0
  },
  plazo: {
    type: Number,
    required: true,
    min: 1
  },
  frecuencia: {
    type: String,
    enum: ['diario', 'semanal', 'quincenal', 'mensual'],
    default: 'diario'
  },
  fechaInicio: {
    type: Date,
    default: Date.now
  },
  fechaVencimiento: {
    type: Date,
    required: true
  },
  estado: {
    type: String,
    enum: ['activo', 'pagado', 'vencido', 'cancelado'],
    default: 'activo'
  },
  ultimoPago: {
    type: Date
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  creadoPorRol: {
    type: String,
    enum: ['admin', 'cobrador'],
    default: 'admin'
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para búsquedas rápidas
prestamoSchema.index({ clienteId: 1, tenantId: 1 });
prestamoSchema.index({ estado: 1, tenantId: 1 });
prestamoSchema.index({ fechaVencimiento: 1 });
prestamoSchema.index({ creadoPor: 1 });

// Middleware para calcular total antes de guardar
prestamoSchema.pre('save', function(next) {
  if (this.isModified('capital') || this.isModified('interes')) {
    this.total = Math.round(this.capital * (1 + (this.interes || 0) / 100));
    this.totalAPagar = this.total;
  }
  next();
});

module.exports = mongoose.model('Prestamo', prestamoSchema);
