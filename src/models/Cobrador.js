const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cobradorSchema = new mongoose.Schema({

  /* NUEVO: multi-tenant */
  tenantId: { 
    type: String,
    required: true,
    index: true
  },

  nombre:   { type: String, required: true },
  cedula:   { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  telefono: { type: String, required: true },
  zona:     { type: String, default: '' },

  /* NUEVO: sede */
  sedeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sede",
    default: null
  },

  password: { type: String, required: true },

  estado:   { type: String, enum: ['activo','inactivo'], default: 'activo' }

}, { timestamps: true });

cobradorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

cobradorSchema.methods.comparePassword = function(p) {
  return bcrypt.compare(p, this.password);
};

module.exports = mongoose.model('Cobrador', cobradorSchema);