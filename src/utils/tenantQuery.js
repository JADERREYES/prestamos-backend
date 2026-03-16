function tenantQuery(req, extra = {}) {

  if (!req.tenantId) {
    throw new Error("Tenant no definido");
  }

  return {
    tenantId: req.tenantId,
    ...extra
  };

}

module.exports = tenantQuery;