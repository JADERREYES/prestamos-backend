const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({

  nombre: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  rol: {
    type: String,
    default: 'admin',
    enum: ['admin', 'superadmin', 'superadministrador']
  },

  tenantId: {
    type: String,
    default: null,
    index: true
  }

}, {
  timestamps: true
});


/* =========================
   HASH PASSWORD
========================= */

adminSchema.pre('save', async function (next) {

  try {

    // Evita rehashear si no cambió la contraseña
    if (!this.isModified('password')) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);

    this.password = await bcrypt.hash(this.password, salt);

    next();

  } catch (error) {

    next(error);

  }

});


/* =========================
   COMPARE PASSWORD
========================= */

adminSchema.methods.comparePassword = async function (candidatePassword) {

  try {

    return await bcrypt.compare(candidatePassword, this.password);

  } catch (error) {

    throw error;

  }

};


module.exports = mongoose.model('Admin', adminSchema, 'admins');