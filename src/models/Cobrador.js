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
    unique: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  cedula: {
    type: String,
    required: true,
    unique: true,
    index: true
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
  }
}, {
  timestamps: true
});

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