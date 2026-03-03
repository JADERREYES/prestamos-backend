const mongoose = require('mongoose');

const inventarioSchema = new mongoose.Schema({
  tipo: { type: String, required: true }, // moto, tablet, telefono, etc.
  descripcion: { type: String, required: true },
  serie: { type: String, default: '' },
  cobrador: { type: mongoose.Schema.Types.ObjectId, ref: 'Cobrador' },
  fechaAsignacion: { type: Date },
  estado: { type: String, enum: ['disponible', 'asignado', 'mantenimiento'], default: 'disponible' }
}, { timestamps: true });

module.exports = mongoose.model('Inventario', inventarioSchema);
