const express = require("express");
const router = express.Router();
const Sede = require("../models/Sede");

router.get("/", async (req,res)=>{

  const sedes = await Sede.find({
    tenantId:req.tenantId
  });

  res.json(sedes);

});

router.post("/", async (req,res)=>{

  const sede = await Sede.create({
    tenantId:req.tenantId,
    ...req.body
  });

  res.json(sede);

});

router.delete("/:id", async(req,res)=>{

  await Sede.deleteOne({
    _id:req.params.id,
    tenantId:req.tenantId
  });

  res.json({message:"Sede eliminada"});

});

module.exports = router;