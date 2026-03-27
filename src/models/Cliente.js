const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre: {
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
  email: {
    type: String,
    lowercase: true,
    sparse: true
  },
  tipo: {
    type: String,
    enum: ['regular', 'vip', 'nuevo'],
    default: 'regular'
  },
  cobrador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cobrador',
    index: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  notas: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para búsquedas rápidas
clienteSchema.index({ nombre: 1, tenantId: 1 });
clienteSchema.index({ cedula: 1, tenantId: 1 }, { unique: true });
clienteSchema.index({ cobrador: 1 });

module.exports = mongoose.model('Cliente', clienteSchema);