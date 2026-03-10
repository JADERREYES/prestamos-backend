const mongoose = require("mongoose");

const SedeSchema = new mongoose.Schema({

  tenantId:{
    type:String,
    required:true
  },

  nombre:{
    type:String,
    required:true
  },

  direccion:String

},{timestamps:true});

module.exports = mongoose.model("Sede",SedeSchema);