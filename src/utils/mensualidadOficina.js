const MONTO_MENSUALIDAD_DEFAULT = 350000;
const TENANT_ID_REGEX = /^[a-z0-9_][a-z0-9_-]{1,63}$/;

const normalizarTenantId = (valor) => String(valor || '')
  .trim()
  .toLowerCase();

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const handleMongoError = (error) => {
  if (error?.code === 11000) {
    return createHttpError(409, 'Ya existe un registro para este tenant y periodo');
  }

  return error;
};

const validarObjectId = (mongoose, id, nombre = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(400, `${nombre} invalido`);
  }
};

const validarTenantId = (tenantId) => {
  const value = normalizarTenantId(tenantId);

  if (!TENANT_ID_REGEX.test(value)) {
    throw createHttpError(400, 'tenantId invalido');
  }

  return value;
};

const validarLongitud = (valor, nombre, max) => {
  const value = String(valor || '').trim();

  if (value.length > max) {
    throw createHttpError(400, `${nombre} excede ${max} caracteres`);
  }

  return value;
};

const getPeriodoActual = (fecha = new Date()) => {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const parsePeriodo = (periodo) => {
  const value = String(periodo || '').trim();
  const match = value.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    throw createHttpError(400, 'Periodo invalido. Use formato YYYY-MM');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw createHttpError(400, 'Mes invalido en periodo');
  }

  return { year, month };
};

const getDiaBaseTenant = (tenant) => {
  if (tenant.diaVencimientoMensualidad) {
    return tenant.diaVencimientoMensualidad;
  }

  if (tenant.fechaCreacion) {
    return new Date(tenant.fechaCreacion).getDate();
  }

  return 1;
};

const getFechaVencimiento = (tenant, periodo) => {
  const { year, month } = parsePeriodo(periodo);
  const diaBase = Math.min(Math.max(Number(getDiaBaseTenant(tenant)) || 1, 1), 31);
  const ultimoDiaMes = new Date(year, month, 0).getDate();
  const diaVencimiento = Math.min(diaBase, ultimoDiaMes);
  const diasGracia = Math.max(Number(tenant.diasGraciaMensualidad) || 0, 0);

  return new Date(year, month - 1, diaVencimiento + diasGracia, 0, 0, 0, 0);
};

const getMontoMensualidad = (tenant) => Number(tenant.montoMensualidad) || MONTO_MENSUALIDAD_DEFAULT;

const getDiasMora = (fechaVencimiento, fechaBase = new Date()) => {
  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);

  const hoy = new Date(fechaBase);
  hoy.setHours(0, 0, 0, 0);

  if (hoy <= vencimiento) {
    return 0;
  }

  return Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24));
};

const calcularEstadoMensualidad = (mensualidad, fechaBase = new Date()) => {
  if (mensualidad?.estado === 'pagado' || mensualidad?.fechaPago) {
    return { estado: 'pagado', diasMora: 0 };
  }

  const diasMora = getDiasMora(mensualidad.fechaVencimiento, fechaBase);

  return {
    estado: diasMora > 0 ? 'vencido' : 'pendiente',
    diasMora
  };
};

const serializarMensualidad = (mensualidad, tenant, fechaBase = new Date()) => {
  const mensualidadObj = typeof mensualidad.toObject === 'function'
    ? mensualidad.toObject()
    : mensualidad;

  const estadoCalculado = calcularEstadoMensualidad(mensualidadObj, fechaBase);

  return {
    ...mensualidadObj,
    tenant: tenant ? {
      _id: tenant._id,
      nombre: tenant.nombre,
      tenantId: tenant.tenantId,
      estado: tenant.estado
    } : undefined,
    estado: estadoCalculado.estado,
    diasMora: estadoCalculado.diasMora
  };
};

const crearMensualidadBase = (tenant, periodo) => ({
  tenantId: normalizarTenantId(tenant.tenantId),
  periodo,
  monto: getMontoMensualidad(tenant),
  fechaVencimiento: getFechaVencimiento(tenant, periodo),
  estado: 'pendiente'
});

module.exports = {
  calcularEstadoMensualidad,
  createHttpError,
  crearMensualidadBase,
  getFechaVencimiento,
  getMontoMensualidad,
  getPeriodoActual,
  handleMongoError,
  normalizarTenantId,
  parsePeriodo,
  serializarMensualidad,
  validarLongitud,
  validarObjectId,
  validarTenantId
};
