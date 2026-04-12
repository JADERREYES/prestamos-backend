const mongoose = require('mongoose');

const notificacionOficinaSchema = new mongoose.Schema(
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
    tipo: {
      type: String,
      enum: ['mensualidad_morosa'],
      default: 'mensualidad_morosa',
      index: true
    },
    titulo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    mensaje: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    leida: {
      type: Boolean,
      default: false,
      index: true
    },
    fechaLeida: {
      type: Date,
      default: null
    },
    enviadaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    mensualidadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MensualidadOficina',
      default: null
    },
    periodo: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/
    },
    metadata: {
      monto: {
        type: Number,
        default: 0
      },
      diasMora: {
        type: Number,
        default: 0
      },
      fechaVencimiento: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

notificacionOficinaSchema.index({ tenantId: 1, createdAt: -1 });
notificacionOficinaSchema.index({ tenantId: 1, leida: 1, createdAt: -1 });
notificacionOficinaSchema.index(
  { tenantId: 1, periodo: 1, tipo: 1, leida: 1 },
  { unique: true, partialFilterExpression: { leida: false } }
);

module.exports = mongoose.model('NotificacionOficina', notificacionOficinaSchema);
