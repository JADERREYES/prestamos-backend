require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();

/* =========================
   CORS
========================= */

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

/* =========================
   JSON
========================= */

app.use(express.json({
  verify: (req,res,buf)=>{
    try{
      JSON.parse(buf);
    }catch(e){
      res.status(400).json({
        error:'JSON inválido'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ extended:true }));

/* =========================
   LOGGER
========================= */

app.use((req,res,next)=>{
  console.log(`📡 ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

/* =========================
   TEST
========================= */

app.get('/', (req,res)=>{
  res.json({
    message:"API funcionando",
    timestamp:new Date().toISOString()
  });
});

app.get('/api/test',(req,res)=>{
  res.json({
    message:"API funcionando correctamente"
  });
});

/* =========================
   AUTH
========================= */

app.use('/api/auth', require('./routes/auth'));

/* =========================
   DECODIFICAR TOKEN
========================= */

app.use((req,res,next)=>{

  const token = req.headers.authorization?.split(' ')[1];

  if(token){

    try{

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'tu_secreto_temporal'
      );

      req.user = decoded;

    }catch(err){
      console.log('⚠️ Token inválido:', err.message);
    }

  }

  next();

});

/* =========================
   TENANT MIDDLEWARE
========================= */

const tenantMiddleware = require('./middleware/tenant.middleware');

app.use(tenantMiddleware);

/* =========================
   RUTAS
========================= */

app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/cobradores', require('./routes/cobradores'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/prestamos', require('./routes/prestamos'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/sedes', require('./routes/sedes'));
app.use('/api/dashboard-charts', require('./routes/dashboardCharts'));
app.use('/api/cobrador', require('./routes/cobrador.routes'));
app.use('/api/calendario', require('./routes/calendario'));
app.use('/api/cartera', require('./routes/cartera'));

/* =========================
   404
========================= */

app.use('*',(req,res)=>{
  res.status(404).json({
    error:'Ruta no encontrada',
    path:req.originalUrl
  });
});

/* =========================
   MONGO
========================= */

mongoose.connect(process.env.MONGODB_URI)
.then(()=>{
  console.log("✅ MongoDB conectado");
  console.log(`📊 Base de datos activa: ${mongoose.connection.name}`);
})
.catch(err=>{
  console.log("❌ Error MongoDB:",err.message);
  process.exit(1);
});

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});