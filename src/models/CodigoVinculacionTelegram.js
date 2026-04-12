const mongoose = require('mongoose');

const codigoVinculacionTelegramSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true
    },
    cobradorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cobrador',
      required: true,
      index: true
    },
    tenantId: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    estado: {
      type: String,
      enum: ['activo', 'usado', 'vencido', 'expirado'],
      default: 'activo',
      index: true
    },
    expiraEn: {
      type: Date,
      required: true,
      index: true
    },
    usadoEn: {
      type: Date,
      default: null
    },
    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    creadoPorRol: {
      type: String,
      enum: ['admin', 'superadmin', 'superadministrador'],
      required: true
    },
    telegramChatIdUsado: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

codigoVinculacionTelegramSchema.index({ cobradorId: 1, estado: 1, expiraEn: 1 });

module.exports = mongoose.model('CodigoVinculacionTelegram', codigoVinculacionTelegramSchema);
