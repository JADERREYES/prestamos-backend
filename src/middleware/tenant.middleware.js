const jwt = require("jsonwebtoken");

module.exports = function tenantMiddleware(req, res, next) {

  // No aplicar multi-tenant en login
  if (req.path.startsWith("/api/auth")) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Token requerido"
    });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.tenantId = decoded.tenantId;

    next();

  } catch (error) {

    return res.status(401).json({
      error: "Token inválido"
    });

  }
};