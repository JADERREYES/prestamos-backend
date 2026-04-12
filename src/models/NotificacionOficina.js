const mongoose = require('mongoose');

const notificacionOficinaSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true
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
      trim: true
    },
    mensaje: {
      type: String,
      required: true,
      trim: true
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

module.exports = mongoose.model('NotificacionOficina', notificacionOficinaSchema);
