const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  prestamoId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Prestamo', 
    required: true 
  },
  monto: { 
    type: Number, 
    required: true 
  },
  fecha: { 
    type: Date, 
    default: Date.now 
  },
  cobradorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Cobrador' 
  },
  tenantId: { 
    type: String, 
    required: true,
    index: true
  },
  metodo: { 
    type: String, 
    enum: ['efectivo', 'transferencia', 'tarjeta'],
    default: 'efectivo'
  },
  observacion: { 
    type: String, 
    default: '' 
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Pago', pagoSchema);