const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  prestamo: { type: mongoose.Schema.Types.ObjectId, ref: 'Prestamo', required: true },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  cobrador: { type: mongoose.Schema.Types.ObjectId, ref: 'Cobrador', required: true },
  monto: { type: Number, required: true },
  fechaPago: { type: Date, default: Date.now },
  notas: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Pago', pagoSchema);
