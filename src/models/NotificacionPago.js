const mongoose = require('mongoose');

const notificacionPagoSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true
    },
    empresa: {
      type: String,
      required: true
    },
    tipo: {
      type: String,
      enum: ['normal', 'mensual'],
      required: true
    },
    mensaje: {
      type: String,
      required: true
    },
    monto: {
      type: Number,
      default: 0
    },
    diasAtraso: {
      type: Number,
      default: 0
    },
    fechaVencimiento: {
      type: String,
      default: ''
    },
    enviadaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    enviadaPorTipo: {
      type: String,
      default: 'superadmin'
    },
    fechaEnvio: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('NotificacionPago', notificacionPagoSchema);