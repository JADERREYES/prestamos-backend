const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  direccion: {
    type: String,
    default: ''
  },
  telefono: {
    type: String,
    default: ''
  },
  tenantId: {
    type: String,
    required: true,
    unique: true
  },
  codigoEmpresa: {
    type: String,
    required: true,
    unique: true
  },
  estado: {
    type: Boolean,
    default: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Tenant', tenantSchema);