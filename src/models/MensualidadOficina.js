const mongoose = require('mongoose');

const mensualidadOficinaSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
      match: /^[a-z0-9_][a-z0-9_-]{1,63}$/
    },
    periodo: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/
    },
    monto: {
      type: Number,
      required: true,
      min: 0
    },
    fechaVencimiento: {
      type: Date,
      required: true,
      index: true
    },
    fechaPago: {
      type: Date,
      default: null,
      index: true
    },
    estado: {
      type: String,
      enum: ['pendiente', 'pagado', 'vencido'],
      default: 'pendiente',
      index: true
    },
    metodoPago: {
      type: String,
      enum: ['efectivo', 'transferencia', 'tarjeta', 'otros'],
      default: 'efectivo'
    },
    referencia: {
      type: String,
      default: '',
      maxlength: 80,
      trim: true
    },
    registradoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    notas: {
      type: String,
      default: '',
      maxlength: 500,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

mensualidadOficinaSchema.index({ tenantId: 1, periodo: 1 }, { unique: true });
mensualidadOficinaSchema.index({ estado: 1, fechaVencimiento: 1 });

module.exports = mongoose.model('MensualidadOficina', mensualidadOficinaSchema);
