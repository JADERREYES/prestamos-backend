require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const tenantMiddleware = require('./middleware/tenant.middleware');

const app = express();

/* CORS */

app.use(cors({
  origin:true,
  credentials:true
}));

app.use(express.json());

/* LOGGER */

app.use((req,res,next)=>{

  console.log(req.method, req.path);
  next();

});

/* MULTI TENANT */

app.use(tenantMiddleware);

/* RUTAS */

app.use('/api/auth', require('./routes/auth'));
app.use('/api/cobradores', require('./routes/cobradores'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/prestamos', require('./routes/prestamos'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/sedes', require('./routes/sedes'));
app.use('/api/dashboard-charts', require('./routes/dashboardCharts'));

/* TEST */

app.get('/',(req,res)=>{
  res.json({message:"API funcionando"});
});

/* MONGO */

mongoose.connect(process.env.MONGODB_URI)
.then(()=>console.log("MongoDB conectado"))
.catch(err=>console.log(err));

const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
  console.log("Servidor corriendo en puerto",PORT);
});