const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  cedula: { type: String, required: true, unique: true },
  celular: { type: String, required: true },
  direccion: { type: String, required: true },
  tipoCliente: { type: String, enum: ['nuevo', 'recurrente', 'moroso'], default: 'nuevo' },
  cobrador: { type: mongoose.Schema.Types.ObjectId, ref: 'Cobrador', required: true },
  estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' }
}, { timestamps: true });

module.exports = mongoose.model('Cliente', clienteSchema);
