const express = require("express");
const router = express.Router();

const Prestamo = require("../models/Prestamo");
const Pago = require("../models/Pago");
const Sede = require("../models/Sede");

router.get("/", async (req,res)=>{

 try{

  const tenantId = req.tenantId;

  const sedes = await Sede.find({ tenantId });

  /* CARTERA POR SEDE */

  const carteraSede = [];

  for(const sede of sedes){

    const prestamos = await Prestamo.find({
      tenantId,
      sedeId:sede._id
    });

    const total = prestamos.reduce(
      (sum,p)=> sum + (p.totalAPagar || 0),
      0
    );

    carteraSede.push({
      sede:sede.nombre,
      total
    });

  }

  /* COBROS DIARIOS */

  const pagos = await Pago.aggregate([
    {
      $match:{ tenantId }
    },
    {
      $group:{
        _id:{
          $dateToString:{
            format:"%Y-%m-%d",
            date:"$createdAt"
          }
        },
        total:{ $sum:"$monto" }
      }
    },
    { $sort:{ _id:1 } }
  ]);

  /* PRESTAMOS ACTIVOS */

  const prestamosActivos = await Prestamo.countDocuments({
    tenantId,
    estado:"activo"
  });

  res.json({
    carteraSede,
    pagos,
    prestamosActivos
  });

 }catch(err){

  res.status(500).json({error:err.message});

 }

});

module.exports = router;