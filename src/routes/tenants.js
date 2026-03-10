const express = require("express");
const router = express.Router();

const Tenant = require("../models/Tenant");

/* CREAR OFICINA */

router.post("/", async (req,res)=>{

  try{

    const tenant = await Tenant.create(req.body);

    res.json(tenant);

  }catch(err){

    res.status(500).json({error:err.message})

  }

});


/* LISTAR OFICINAS */

router.get("/", async(req,res)=>{

  const tenants = await Tenant.find();

  res.json(tenants);

});


/* ELIMINAR OFICINA */

router.delete("/:id", async(req,res)=>{

  await Tenant.findByIdAndDelete(req.params.id);

  res.json({message:"Oficina eliminada"});

});

module.exports = router;