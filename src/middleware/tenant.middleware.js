const jwt = require('jsonwebtoken');

const tenantMiddleware = async (req, res, next) => {
  try {

    console.log("🔍 Tenant Middleware - Path:", req.path);

    const rutasPublicas = [
      '/api/auth/',
      '/api/superadmin/',
      '/api/test'
    ];

    const esRutaPublica = rutasPublicas.some(ruta =>
      req.path.startsWith(ruta)
    );

    const token = req.headers.authorization?.split(' ')[1];

    /* =========================
       RUTAS PUBLICAS
    ========================= */

    if (esRutaPublica) {

      console.log(`🔓 Ruta pública: ${req.path}`);

      if (token) {
        try {

          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'tu_secreto_temporal'
          );

          req.user = decoded;

          if (decoded.tenantId) {
            req.tenantId = decoded.tenantId.toLowerCase().trim();
          }

          console.log(
            "👤 Usuario en ruta pública:",
            decoded.email,
            "Rol:",
            decoded.rol,
            "TenantId:",
            req.tenantId
          );

        } catch (err) {
          console.log("⚠️ Token inválido en ruta pública");
        }
      }

      return next();
    }

    /* =========================
       RUTAS PRIVADAS
    ========================= */

    if (!token) {
      return res.status(401).json({
        error: "Token no proporcionado"
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'tu_secreto_temporal'
    );

    req.user = decoded;

    console.log(
      "✅ Token verificado:",
      decoded.email,
      "Rol:",
      decoded.rol,
      "TenantId:",
      decoded.tenantId
    );

    if (
      decoded.rol === 'superadmin' ||
      decoded.rol === 'superadministrador'
    ) {
      console.log('👑 Super Admin detectado');
      return next();
    }

    if (!decoded.tenantId) {
      return res.status(400).json({
        error: 'TenantId no presente en el token'
      });
    }

    /* NORMALIZAR TENANT */

    req.tenantId = decoded.tenantId.toLowerCase().trim();

    console.log(
      `✅ Tenant ID establecido: ${req.tenantId} para usuario: ${decoded.email}`
    );

    next();

  } catch (error) {

    console.error('❌ Error en tenant middleware:', error);

    return res.status(401).json({
      error: 'Token inválido'
    });

  }
};

module.exports = tenantMiddleware;