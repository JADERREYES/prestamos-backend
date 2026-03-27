require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173', 'http://localhost:5174', 'https://super-admin-panel-amber.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
  },
  transports: ['websocket', 'polling']
});

// Guardar io en app para acceder desde las rutas
app.set('io', io);

console.log("🔍 MONGODB_URI:", process.env.MONGODB_URI ? "OK" : "NO DEFINIDO");

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://super-admin-panel-amber.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isLocalAllowed = allowedOrigins.includes(origin);
    const isVercelAllowed = origin.endsWith('.vercel.app');
    if (isLocalAllowed || isVercelAllowed) {
      return callback(null, true);
    }
    return callback(new Error(`CORS no permitido para origen: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));

app.options('*', cors());

app.use(express.json({
  verify: (req,res,buf)=>{
    try{ JSON.parse(buf); }catch(e){
      res.status(400).json({ error:'JSON inválido' });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ extended:true }));

app.use((req,res,next)=>{
  console.log(`📡 ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

/* RUTAS BÁSICAS */
app.get('/', (req,res)=> res.json({ message:"API funcionando", timestamp:new Date().toISOString() }));
app.get('/api/test',(req,res)=> res.json({ message:"API funcionando correctamente" }));

/* AUTH SIN TENANT */
app.use('/api/auth', require('./routes/auth'));

/* DECODIFICAR TOKEN GLOBAL */
app.use((req,res,next)=>{
  const token = req.headers.authorization?.split(' ')[1];
  if(token){
    try{
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_temporal');
      req.user = decoded;
    }catch(err){
      console.log('⚠️ Token inválido:', err.message);
    }
  }
  next();
});

/* RUTAS DE SUPERADMIN */
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/pagos', require('./routes/pagos'));

/* TENANT MIDDLEWARE */
const tenantMiddleware = require('./middleware/tenant.middleware');

// Middlewares de protección por Tenant
app.use('/api/dashboard', tenantMiddleware);
app.use('/api/cobradores', tenantMiddleware);
app.use('/api/clientes', tenantMiddleware);
app.use('/api/prestamos', tenantMiddleware);
app.use('/api/inventario', tenantMiddleware);
app.use('/api/sedes', tenantMiddleware);
app.use('/api/dashboard-charts', tenantMiddleware);
app.use('/api/cobrador', tenantMiddleware);
app.use('/api/calendario', tenantMiddleware);
app.use('/api/cartera', tenantMiddleware);

/* RUTAS DE OFICINA */
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/cobradores', require('./routes/cobradores'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/prestamos', require('./routes/prestamos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/sedes', require('./routes/sedes'));
app.use('/api/dashboard-charts', require('./routes/dashboardCharts'));
app.use('/api/cobrador', require('./routes/cobrador.routes'));
app.use('/api/calendario', require('./routes/calendario'));
app.use('/api/cartera', require('./routes/cartera'));

/* SOCKET.IO - COMUNICACIÓN EN TIEMPO REAL */
io.on('connection', (socket) => {
  console.log('🔌 Nuevo cliente conectado:', socket.id);
  
  socket.on('join-tenant', (tenantId) => {
    socket.join(`tenant-${tenantId}`);
    console.log(`📡 Cliente ${socket.id} unido a sala tenant-${tenantId}`);
    socket.emit('joined', { tenantId, message: 'Conectado al canal de notificaciones' });
  });
  
  socket.on('join-superadmin', () => {
    socket.join('superadmin-room');
    console.log(`👑 Cliente ${socket.id} unido a sala superadmin`);
    socket.emit('joined', { message: 'Conectado como Super Admin' });
  });
  
  socket.on('pago-registrado', (data) => {
    console.log('💰 Pago registrado:', data);
    io.to('superadmin-room').emit('nueva-notificacion', {
      type: 'pago',
      empresa: data.empresa,
      mensaje: `${data.empresa} ha realizado un pago de $${data.monto.toLocaleString()}`,
      fecha: new Date()
    });
  });
  
  // ============================================
  // RECORDATORIO NORMAL CON MENSAJE PERSONALIZADO
  // ============================================
  socket.on('enviar-recordatorio', (data) => {
    console.log('🔔 Recordatorio enviado a:', data.empresa);
    const mensaje = data.mensajePersonalizado || `⚠️ RECORDATORIO: Tienes un pago pendiente de $${data.monto.toLocaleString()} con ${data.diasAtraso} días de atraso.`;
    
    io.to(`tenant-${data.tenantId}`).emit('recibido-recordatorio', {
      type: 'recordatorio-pago',
      empresa: data.empresa,
      mensaje: mensaje,
      fechaVencimiento: data.fechaVencimiento,
      diasAtraso: data.diasAtraso,
      monto: data.monto,
      fecha: new Date()
    });
    socket.emit('recordatorio-enviado', {
      success: true,
      empresa: data.empresa,
      mensaje: `Recordatorio enviado a ${data.empresa}`
    });
  });
  
  // ============================================
  // RECORDATORIO MENSUAL CON MENSAJE PERSONALIZADO
  // ============================================
  socket.on('enviar-recordatorio-mensual', (data) => {
    console.log('📅 Recordatorio mensual enviado a:', data.empresa);
    const mensaje = data.mensajePersonalizado || `⚠️ RECORDATORIO MENSUAL: Tienes un pago pendiente de $${data.monto.toLocaleString()} con ${data.diasAtraso} días de atraso. Fecha vencimiento: ${data.fechaVencimiento}`;
    
    io.to(`tenant-${data.tenantId}`).emit('recibido-recordatorio-mensual', {
      type: 'recordatorio-pago-mensual',
      empresa: data.empresa,
      mensaje: mensaje,
      fechaVencimiento: data.fechaVencimiento,
      diasAtraso: data.diasAtraso,
      monto: data.monto,
      fecha: new Date()
    });
    socket.emit('recordatorio-enviado', {
      success: true,
      empresa: data.empresa,
      mensaje: `Recordatorio mensual enviado a ${data.empresa}`
    });
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

/* DEBUG Y 404 */
app.get('/api/debug/db', (req, res) => {
  res.json({ ok: true, dbName: mongoose.connection.name, readyState: mongoose.connection.readyState });
});

app.use('*',(req,res)=>{
  res.status(404).json({ error:'Ruta no encontrada', path:req.originalUrl });
});

/* MONGO CONECT */
mongoose.connect(process.env.MONGODB_URI)
.then(()=>{
  console.log("✅ MongoDB conectado");
})
.catch(err=>{
  console.log("❌ Error MongoDB:", err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT,()=> console.log(`🚀 Servidor corriendo en puerto ${PORT}`));