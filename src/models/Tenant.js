const mongoose = require("mongoose");

const TenantSchema = new mongoose.Schema({

  nombre:{
    type:String,
    required:true
  },

  direccion:String,
  telefono:String,

  estado:{
    type:Boolean,
    default:true
  }

},{timestamps:true});

module.exports = mongoose.model("Tenant",TenantSchema);