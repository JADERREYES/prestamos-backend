const { verifyToken } = require('../utils/jwt');

const tenantMiddleware = async (req, res, next) => {
  try {
    console.log("🔍 Tenant Middleware - Path:", req.path);
    console.log("🔍 Headers:", req.headers);

    // Rutas públicas que no requieren tenantId
    const rutasPublicas = [
      '/api/auth/',
      '/api/superadmin/',
      '/api/test',
      '/api/pagos/pendientes',
      '/api/pagos/recordatorio',
      '/api/pagos/mensuales-pendientes'
    ];

    const esRutaPublica = rutasPublicas.some(ruta => req.path.startsWith(ruta));

    const token = req.headers.authorization?.split(' ')[1];
    
    // Si es ruta pública, continuar
    if (esRutaPublica) {
      console.log(`🔓 Ruta pública: ${req.path}`);
      if (token) {
        try {
          const decoded = verifyToken(token);
          req.user = decoded;
          if (decoded.tenantId) {
            req.tenantId = decoded.tenantId.toLowerCase().trim();
          }
        } catch (err) {
          console.log("⚠️ Token inválido en ruta pública");
        }
      }
      return next();
    }

    // Para rutas privadas, verificar token
    if (!token) {
      console.log("❌ No hay token");
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    // Decodificar token con manejo de errores
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      console.log("❌ Token inválido:", err.message);
      return res.status(401).json({ error: "Token inválido" });
    }
    
    req.user = decoded;
    console.log(`✅ Token verificado: ${decoded.email} (${decoded.rol})`);

    // Super Admin puede pasar sin tenantId
    if (decoded.rol === 'superadmin' || decoded.rol === 'superadministrador') {
      console.log('👑 Super Admin detectado');
      return next();
    }

    // Para admin y cobrador, verificar tenantId
    if (!decoded.tenantId) {
      console.log("❌ No hay tenantId en el token");
      return res.status(400).json({ error: 'TenantId no presente en el token' });
    }

    // Establecer tenantId
    req.tenantId = decoded.tenantId.toLowerCase().trim();
    console.log(`✅ Tenant ID establecido: ${req.tenantId} para usuario: ${decoded.email} (${decoded.rol})`);

    next();
  } catch (error) {
    console.error('❌ Error en tenant middleware:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = tenantMiddleware;
