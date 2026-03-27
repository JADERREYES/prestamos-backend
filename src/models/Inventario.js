const mongoose = require('mongoose');

const inventarioSchema = new mongoose.Schema({
  tipo: { 
    type: String, 
    required: true,
    trim: true
  },
  descripcion: { 
    type: String, 
    required: true,
    trim: true
  },
  serie: { 
    type: String, 
    default: '',
    trim: true
  },
  cobrador: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Cobrador',
    default: null
  },
  fechaAsignacion: { 
    type: Date,
    default: null
  },
  estado: { 
    type: String, 
    enum: ['disponible', 'asignado', 'mantenimiento'], 
    default: 'disponible' 
  },
  tenantId: { 
    type: String, 
    required: true, 
    index: true 
  },
  // Campos adicionales
  marca: { 
    type: String, 
    default: '',
    trim: true
  },
  modelo: { 
    type: String, 
    default: '',
    trim: true
  },
  valor: { 
    type: Number, 
    default: 0
  },
  notas: { 
    type: String, 
    default: '',
    trim: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para obtener información del cobrador
inventarioSchema.virtual('cobradorInfo', {
  ref: 'Cobrador',
  localField: 'cobrador',
  foreignField: '_id',
  justOne: true
});

// Middleware para actualizar fecha de asignación
inventarioSchema.pre('save', function(next) {
  if (this.isModified('cobrador')) {
    if (this.cobrador) {
      this.fechaAsignacion = new Date();
      this.estado = 'asignado';
    } else {
      this.fechaAsignacion = null;
      this.estado = 'disponible';
    }
  }
  next();
});

// Índices para mejor rendimiento
inventarioSchema.index({ tenantId: 1, estado: 1 });
inventarioSchema.index({ cobrador: 1 });
inventarioSchema.index({ tipo: 1 });

const Inventario = mongoose.models.Inventario || mongoose.model('Inventario', inventarioSchema);

module.exports = Inventario;