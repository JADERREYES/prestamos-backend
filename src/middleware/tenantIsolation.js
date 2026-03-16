module.exports = function tenantIsolation(req, res, next) {

  if (!req.tenantId) {

    return res.status(403).json({
      error: "Tenant no identificado"
    });

  }

  /* FILTRO AUTOMATICO PARA MONGODB */

  req.tenantFilter = {
    tenantId: req.tenantId
  };

  next();
};