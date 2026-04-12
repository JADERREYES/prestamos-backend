const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cobradorSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  cedula: {
    type: String,
    required: true
  },
  telefono: {
    type: String,
    required: true
  },
  direccion: {
    type: String,
    default: ''
  },
  zona: {
    type: String,
    default: ''
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  telegramChatId: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  telegramUsername: {
    type: String,
    default: ''
  },
  telegramFirstName: {
    type: String,
    default: ''
  },
  telegramActivo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

cobradorSchema.index({ tenantId: 1, email: 1 }, { unique: true });
cobradorSchema.index({ tenantId: 1, cedula: 1 }, { unique: true });
cobradorSchema.index({ telegramChatId: 1, telegramActivo: 1 });

// Hashear password antes de guardar
cobradorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Cobrador', cobradorSchema);
