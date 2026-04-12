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
  montoMensualidad: {
    type: Number,
    default: 350000,
    min: 0
  },
  diaVencimientoMensualidad: {
    type: Number,
    default: null,
    min: 1,
    max: 31
  },
  diasGraciaMensualidad: {
    type: Number,
    default: 0,
    min: 0
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Tenant', tenantSchema);
