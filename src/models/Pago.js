const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  prestamoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prestamo',
    required: true,
    index: true
  },
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true,
    index: true
  },
  monto: {
    type: Number,
    required: true,
    min: 0
  },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'transferencia', 'tarjeta', 'otros'],
    default: 'efectivo'
  },
  referencia: {
    type: String,
    default: ''
  },
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  },
  registradoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cobrador'
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Índices para búsquedas rápidas
pagoSchema.index({ prestamoId: 1, fecha: -1 });
pagoSchema.index({ clienteId: 1, fecha: -1 });
pagoSchema.index({ fecha: -1, tenantId: 1 });

module.exports = mongoose.model('Pago', pagoSchema);