require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const dns = require('dns');
const socketIo = require('socket.io');
const { verifyToken } = require('./utils/jwt');
const { setupTelegramWebhook } = require('./telegram/bot');

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
app.use('/api/telegram', require('./routes/telegram.webhook'));
app.use('/api/ia', require('./routes/ia.routes'));

/* DECODIFICAR TOKEN GLOBAL */
app.use((req,res,next)=>{
  const token = req.headers.authorization?.split(' ')[1];
  if(token){
    try{
      const decoded = verifyToken(token);
      req.user = decoded;
    }catch(err){
      console.log('⚠️ Token inválido:', err.message);
    }
  }
  next();
});

/* RUTAS DE SUPERADMIN */
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/superadmin/mensualidades', require('./routes/mensualidades'));
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
app.use('/api/oficina/mensualidad', tenantMiddleware);
app.use('/api/oficina/notificaciones', tenantMiddleware);

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
app.use('/api/oficina/mensualidad', require('./routes/oficinaMensualidad'));
app.use('/api/oficina/notificaciones', require('./routes/oficinaNotificaciones'));

/* SOCKET.IO - COMUNICACIÓN EN TIEMPO REAL */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) {
    return next(new Error('Token requerido'));
  }

  try {
    socket.user = verifyToken(token);
    return next();
  } catch (err) {
    return next(new Error('Token invalido'));
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Nuevo cliente conectado:', socket.id);
  
  socket.on('join-tenant', () => {
    const tenantId = socket.user?.tenantId;

    if (!tenantId || socket.user?.rol === 'superadmin' || socket.user?.rol === 'superadministrador') {
      socket.emit('join-error', { error: 'Tenant no autorizado para este usuario' });
      return;
    }

    socket.join(`tenant-${tenantId}`);
    console.log(`📡 Cliente ${socket.id} unido a sala tenant-${tenantId}`);
    socket.emit('joined', { tenantId, message: 'Conectado al canal de notificaciones' });
  });
  
  socket.on('join-superadmin', () => {
    if (socket.user?.rol !== 'superadmin' && socket.user?.rol !== 'superadministrador') {
      socket.emit('join-error', { error: 'Solo superadmin puede unirse a esta sala' });
      return;
    }

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
    if (socket.user?.rol !== 'superadmin' && socket.user?.rol !== 'superadministrador') {
      socket.emit('recordatorio-enviado', { success: false, mensaje: 'No autorizado' });
      return;
    }

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
    if (socket.user?.rol !== 'superadmin' && socket.user?.rol !== 'superadministrador') {
      socket.emit('recordatorio-enviado', { success: false, mensaje: 'No autorizado' });
      return;
    }

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
dns.setServers(['8.8.8.8', '1.1.1.1']);
console.log('DNS configurado para MongoDB Atlas:', dns.getServers());

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000
})
  .then(async () => {
    await setupTelegramWebhook();
    console.log("✅ MongoDB conectado");
  })
  .catch(err => {
    console.error("❌ Error MongoDB:", {
      name: err.name,
      code: err.code,
      message: err.message
    });
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;
server.listen(PORT,()=> console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
