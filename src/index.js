require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware CORS
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://frontend-admin-mu-fawn.vercel.app',
      process.env.FRONTEND_ADMIN_URL,
      process.env.FRONTEND_COBRADOR_URL,
    ].filter(Boolean);

    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS bloqueado para origen:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Manejo de preflight para todas las rutas
app.options('*', cors());

app.use(express.json());

// Conectar MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cobradores', require('./routes/cobradores'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/prestamos', require('./routes/prestamos'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/', (req, res) => res.json({ message: 'API Gota a Gota funcionando ✅' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));