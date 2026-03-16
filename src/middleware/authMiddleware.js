const adminOnly = (req, res, next) => {

  if (!req.user) {
    return res.status(401).json({
      error: "Usuario no autenticado"
    });
  }

  if (req.user.rol !== "admin") {
    return res.status(403).json({
      error: "Solo administradores"
    });
  }

  next();
};

const cobradorOnly = (req, res, next) => {

  if (!req.user) {
    return res.status(401).json({
      error: "Usuario no autenticado"
    });
  }

  if (req.user.rol !== "cobrador") {
    return res.status(403).json({
      error: "Solo cobradores"
    });
  }

  next();
};

module.exports = {
  adminOnly,
  cobradorOnly
};