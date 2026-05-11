const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const Pago = require('../models/Pago');

const MAX_RESULTS = 5;

const normalizeText = (text) => String(text || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatMoney = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

const formatDate = (value) => {
  if (!value) return 'Sin registro';
  return new Date(value).toLocaleString('es-CO');
};

const getSaldoPendiente = (prestamo) => Math.max(
  Number(prestamo.totalAPagar || 0) - Number(prestamo.totalPagado || 0),
  0
);

const getValorCuota = (prestamo) => {
  const plazo = Number(prestamo.plazo || 0);
  if (!plazo || plazo <= 0) return null;
  return Math.round(Number(prestamo.totalAPagar || 0) / plazo);
};

const getCuotasPagadasEstimadas = (prestamo) => {
  const valorCuota = getValorCuota(prestamo);
  const plazo = Number(prestamo.plazo || 0);

  if (!valorCuota || !plazo) return null;

  return Math.max(0, Math.min(plazo, Math.floor(Number(prestamo.totalPagado || 0) / valorCuota)));
};

const getCuotasPendientesEstimadas = (prestamo) => {
  const plazo = Number(prestamo.plazo || 0);
  const pagadas = getCuotasPagadasEstimadas(prestamo);

  if (!plazo || pagadas === null) return null;
  return Math.max(plazo - pagadas, 0);
};

const OPERATIONAL_INTENTS = [
  {
    intent: 'pagos_hoy',
    patterns: ['pagos de hoy', 'que pagos tengo hoy', 'cobros de hoy', 'pagos hoy', 'cobros hoy'],
    requiresClient: false
  },
  {
    intent: 'resumen_oficina',
    patterns: ['resumen de mi oficina', 'resumen oficina', 'resumen de oficina', 'estado de mi oficina', 'mi resumen'],
    requiresClient: false
  },
  {
    intent: 'clientes_morosos',
    patterns: ['clientes morosos', 'morosos', 'clientes en mora', 'clientes atrasados', 'cartera vencida'],
    requiresClient: false
  },
  {
    intent: 'pendientes',
    patterns: ['pagos pendientes', 'cobros pendientes', 'cartera pendiente', 'quien debe', 'clientes pendientes', 'pendientes'],
    requiresClient: false
  },
  {
    intent: 'prestamos_activos',
    patterns: ['prestamos activos', 'prestamo activo', 'creditos activos', 'credito activo'],
    requiresClient: false
  },
  {
    intent: 'prestamos_pagados',
    patterns: ['prestamos pagados', 'prestamo pagado', 'creditos pagados', 'credito pagado'],
    requiresClient: false
  },
  {
    intent: 'historial',
    patterns: ['historial de', 'historial', 'movimientos de', 'pagos de', 'estado de'],
    requiresClient: true
  },
  {
    intent: 'ultimo_pago',
    patterns: ['ultimo pago', 'ultimo abono', 'cuando pago', 'fecha de pago'],
    requiresClient: true
  },
  {
    intent: 'cuotas',
    patterns: ['cuantas cuotas', 'cuotas pagadas', 'cuotas pendientes', 'cuantas le faltan', 'cuota', 'cuotas'],
    requiresClient: true
  },
  {
    intent: 'saldo',
    patterns: ['saldo pendiente', 'cuanto debe', 'saldo', 'deuda', 'debe', 'estado'],
    requiresClient: true
  }
];

const CLIENT_REQUIRED_HELP = {
  saldo: 'Claro. Para consultar el saldo necesito la cedula o el nombre del cliente. Ejemplo: saldo Angela o saldo 1234567890.',
  historial: 'Para revisar el historial necesito la cedula o el nombre del cliente. Ejemplo: historial Angela o historial 1234567890.',
  cuotas: 'Para revisar las cuotas necesito la cedula o el nombre del cliente. Ejemplo: cuotas Angela o cuotas 1234567890.',
  ultimo_pago: 'Para revisar el ultimo pago necesito la cedula o el nombre del cliente. Ejemplo: ultimo pago Angela o ultimo pago 1234567890.'
};

const NOISE_PHRASES = [
  'cuanto debe la cedula',
  'cuanto debe el cliente',
  'cuanto debe',
  'saldo de la cedula',
  'saldo de',
  'saldo',
  'deuda de',
  'deuda',
  'estado de',
  'estado',
  'historial de',
  'historial',
  'ultimo pago de',
  'ultimo pago',
  'ultimo abono de',
  'ultimo abono',
  'cuando pago',
  'fecha de pago de',
  'fecha de pago',
  'cuotas pendientes de',
  'cuotas pagadas de',
  'cuantas cuotas tiene la cedula',
  'cuantas cuotas tiene el cliente',
  'cuantas cuotas tiene',
  'cuantas le faltan a',
  'cuotas de',
  'cuotas',
  'cliente',
  'cedula',
  'la cedula',
  'pagos pendientes de',
  'pagos pendientes',
  'cobros pendientes de',
  'cobros pendientes',
  'cartera pendiente de',
  'cartera pendiente',
  'prestamos activos de',
  'prestamos activos',
  'prestamo activo',
  'creditos activos',
  'prestamos pagados',
  'creditos pagados',
  'moroso',
  'morosos',
  'mora',
  'atrasado',
  'atrasada',
  'que hago si',
  'que hago',
  'que pagos tengo hoy',
  'pagos de hoy',
  'resumen de mi oficina',
  'resumen de oficina',
  'resumen oficina'
];

const detectIntent = (pregunta) => {
  const normalized = normalizeText(pregunta);

  for (const config of OPERATIONAL_INTENTS) {
    if (config.patterns.some((pattern) => normalized.includes(pattern))) {
      return config;
    }
  }

  return null;
};

const extractCedula = (pregunta) => {
  const matches = String(pregunta || '').match(/\d{5,30}/g);
  if (!matches?.length) return null;
  return matches.sort((a, b) => b.length - a.length)[0];
};

const stripNameNoise = (pregunta) => {
  let cleaned = normalizeText(pregunta);

  NOISE_PHRASES.forEach((phrase) => {
    cleaned = cleaned.replaceAll(phrase, ' ');
  });

  cleaned = cleaned.replace(/\d{5,30}/g, ' ');
  cleaned = cleaned.replace(/\b(la|el|los|las|del|de|al|para|por|hoy|mi|oficina|cliente)\b/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .filter((part) => part.length > 1)
    .join(' ');
};

const extractExplicitName = (pregunta) => {
  const cleaned = stripNameNoise(pregunta);
  return cleaned || '';
};

const buildClienteQuery = ({ tenantId, cobrador }) => {
  const query = {
    tenantId,
    activo: true
  };

  if (cobrador?._id) {
    query.cobrador = cobrador._id;
  }

  return query;
};

const findClienteByCedula = async ({ tenantId, cedula, cobrador }) => Cliente.findOne({
  ...buildClienteQuery({ tenantId, cobrador }),
  cedula: String(cedula || '').trim()
}).lean();

const findClientesByNombre = async ({ tenantId, name, cobrador }) => {
  const normalizedName = normalizeText(name);
  const tokens = normalizedName.split(' ').filter(Boolean);
  const regexPattern = tokens.map((token) => escapeRegex(token)).join('.*');

  return Cliente.find({
    ...buildClienteQuery({ tenantId, cobrador }),
    nombre: { $regex: regexPattern, $options: 'i' }
  })
    .select('nombre cedula telefono tenantId createdAt cobrador')
    .sort({ nombre: 1 })
    .limit(MAX_RESULTS + 1)
    .lean();
};

const findPrestamosByCliente = async ({ tenantId, clienteId }) => Prestamo.find({
  tenantId,
  clienteId
})
  .sort({ createdAt: -1 })
  .lean();

const findPagosByCliente = async ({ tenantId, clienteId, limite = 5 }) => Pago.find({
  tenantId,
  clienteId
})
  .sort({ fecha: -1, createdAt: -1 })
  .limit(limite)
  .lean();

const findUltimoPagoCliente = async ({ tenantId, clienteId }) => Pago.findOne({
  tenantId,
  clienteId
})
  .sort({ fecha: -1, createdAt: -1 })
  .lean();

const selectReferencePrestamo = (prestamos) => {
  if (!prestamos.length) return null;

  const activos = prestamos.filter((prestamo) => ['activo', 'vencido'].includes(prestamo.estado));
  if (activos.length) return activos[0];
  return prestamos[0];
};

const buildMultipleMatchesResponse = (clientes) => [
  'Encontre varios clientes parecidos. Escribe la cedula para mayor precision.',
  ...clientes.slice(0, MAX_RESULTS).map((cliente, index) => `${index + 1}. ${cliente.nombre} - Cedula ${cliente.cedula}`)
].join('\n');

const resolveClienteContext = async ({ pregunta, tenantId, cobrador, intentConfig }) => {
  const cedula = extractCedula(pregunta);
  const explicitName = extractExplicitName(pregunta);

  if (cedula) {
    const cliente = await findClienteByCedula({ tenantId, cedula, cobrador });
    return {
      searchType: 'cedula',
      cedula,
      cliente,
      multiple: false
    };
  }

  if (!explicitName) {
    return {
      searchType: 'missing',
      cliente: null,
      multiple: false,
      message: CLIENT_REQUIRED_HELP[intentConfig?.intent] || CLIENT_REQUIRED_HELP.saldo
    };
  }

  const matches = await findClientesByNombre({ tenantId, name: explicitName, cobrador });

  if (!matches.length) {
    return {
      searchType: 'nombre',
      cliente: null,
      multiple: false
    };
  }

  if (matches.length > 1) {
    return {
      searchType: 'nombre',
      cliente: null,
      multiple: true,
      matches
    };
  }

  return {
    searchType: 'nombre',
    cliente: matches[0],
    multiple: false
  };
};

const buildScopedPrestamoQuery = async ({ tenantId, cobrador, estados }) => {
  const query = {
    tenantId
  };

  if (estados?.length) {
    query.estado = { $in: estados };
  }

  if (!cobrador?._id) {
    return query;
  }

  const clientes = await Cliente.find(buildClienteQuery({ tenantId, cobrador })).select('_id').lean();
  const clienteIds = clientes.map((cliente) => cliente._id);

  if (!clienteIds.length) {
    return null;
  }

  query.clienteId = { $in: clienteIds };
  return query;
};

const buildMissingClientResponse = (context) => ({
  manejada: true,
  respuesta: context.message || CLIENT_REQUIRED_HELP.saldo
});

const handleSaldoIntent = async ({ tenantId, pregunta, cobrador, intentConfig }) => {
  const context = await resolveClienteContext({ pregunta, tenantId, cobrador, intentConfig });

  if (context.multiple) {
    return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
  }

  if (!context.cliente) {
    if (context.searchType === 'missing') {
      return buildMissingClientResponse(context);
    }

    return {
      manejada: true,
      respuesta: context.searchType === 'cedula'
        ? 'No encontre un cliente con esa cedula en tu cartera.'
        : 'No encontre ese cliente en tu cartera.'
    };
  }

  const prestamos = await findPrestamosByCliente({ tenantId, clienteId: context.cliente._id });
  if (!prestamos.length) {
    return { manejada: true, respuesta: `El cliente ${context.cliente.nombre} no tiene creditos activos.` };
  }

  const saldoTotal = prestamos.reduce((sum, prestamo) => sum + getSaldoPendiente(prestamo), 0);
  const prestamoReferencia = selectReferencePrestamo(prestamos);
  const ultimoPago = await findUltimoPagoCliente({ tenantId, clienteId: context.cliente._id });

  if (saldoTotal <= 0) {
    return {
      manejada: true,
      respuesta: `El cliente ${context.cliente.nombre} no tiene saldo pendiente. Su credito aparece como ${prestamoReferencia?.estado || 'pagado'}.`
    };
  }

  const parts = [
    `${context.cliente.nombre}, cedula ${context.cliente.cedula}, tiene un saldo pendiente de ${formatMoney(saldoTotal)}.`,
    `Estado del credito: ${prestamoReferencia?.estado || 'activo'}.`
  ];

  if (prestamoReferencia?.capital !== undefined) {
    parts.push(`Monto inicial: ${formatMoney(prestamoReferencia.capital)}.`);
  }

  if (ultimoPago) {
    parts.push(`Ultimo pago registrado: ${formatMoney(ultimoPago.monto)} el ${formatDate(ultimoPago.fecha)}.`);
  }

  return {
    manejada: true,
    respuesta: parts.join(' ')
  };
};

const handleCuotasIntent = async ({ tenantId, pregunta, cobrador, intentConfig }) => {
  const context = await resolveClienteContext({ pregunta, tenantId, cobrador, intentConfig });

  if (context.multiple) {
    return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
  }

  if (!context.cliente) {
    if (context.searchType === 'missing') {
      return buildMissingClientResponse(context);
    }

    return {
      manejada: true,
      respuesta: context.searchType === 'cedula'
        ? 'No encontre un cliente con esa cedula en tu cartera.'
        : 'No encontre ese cliente en tu cartera.'
    };
  }

  const prestamos = await findPrestamosByCliente({ tenantId, clienteId: context.cliente._id });
  const prestamo = selectReferencePrestamo(prestamos);

  if (!prestamo) {
    return { manejada: true, respuesta: `El cliente ${context.cliente.nombre} no tiene creditos activos.` };
  }

  if (!prestamo.plazo) {
    return {
      manejada: true,
      respuesta: 'El credito existe, pero el sistema no tiene registrado el numero total de cuotas.'
    };
  }

  const totalCuotas = Number(prestamo.plazo || 0);
  const cuotasPagadas = getCuotasPagadasEstimadas(prestamo);
  const cuotasPendientes = getCuotasPendientesEstimadas(prestamo);
  const valorCuota = getValorCuota(prestamo);
  const saldoPendiente = getSaldoPendiente(prestamo);

  const parts = [
    `${context.cliente.nombre} tiene un credito de ${totalCuotas} cuotas.`
  ];

  if (cuotasPagadas !== null) {
    parts.push(`Ha pagado ${cuotasPagadas} cuotas.`);
  }

  if (cuotasPendientes !== null) {
    parts.push(`Le faltan ${cuotasPendientes}.`);
  }

  if (valorCuota !== null) {
    parts.push(`Valor estimado por cuota: ${formatMoney(valorCuota)}.`);
  }

  parts.push(`Saldo pendiente: ${formatMoney(saldoPendiente)}.`);
  parts.push(`Estado del credito: ${prestamo.estado}.`);

  return {
    manejada: true,
    respuesta: parts.join(' ')
  };
};

const handleHistorialIntent = async ({ tenantId, pregunta, cobrador, intentConfig }) => {
  const context = await resolveClienteContext({ pregunta, tenantId, cobrador, intentConfig });

  if (context.multiple) {
    return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
  }

  if (!context.cliente) {
    if (context.searchType === 'missing') {
      return buildMissingClientResponse(context);
    }

    return {
      manejada: true,
      respuesta: context.searchType === 'cedula'
        ? 'No encontre un cliente con esa cedula en tu cartera.'
        : 'No encontre ese cliente en tu cartera.'
    };
  }

  const prestamos = await findPrestamosByCliente({ tenantId, clienteId: context.cliente._id });
  const pagos = await findPagosByCliente({ tenantId, clienteId: context.cliente._id, limite: 3 });
  const saldoTotal = prestamos.reduce((sum, prestamo) => sum + getSaldoPendiente(prestamo), 0);
  const prestamoReferencia = selectReferencePrestamo(prestamos);

  const parts = [
    `Historial de ${context.cliente.nombre}, cedula ${context.cliente.cedula}.`
  ];

  if (prestamoReferencia) {
    parts.push(`Credito de referencia: ${prestamoReferencia.estado}.`);
    parts.push(`Saldo pendiente: ${formatMoney(saldoTotal)}.`);

    if (getSaldoPendiente(prestamoReferencia) > 0 && new Date(prestamoReferencia.fechaVencimiento) < new Date()) {
      parts.push(`El credito aparece vencido desde ${formatDate(prestamoReferencia.fechaVencimiento)}.`);
    }
  } else {
    parts.push('No tiene creditos registrados.');
  }

  if (pagos.length) {
    parts.push([
      'Ultimos pagos:',
      ...pagos.map((pago, index) => `${index + 1}. ${formatMoney(pago.monto)} el ${formatDate(pago.fecha)}`)
    ].join('\n'));
  } else {
    parts.push('No tiene pagos registrados.');
  }

  return {
    manejada: true,
    respuesta: parts.join(' ')
  };
};

const handleUltimoPagoIntent = async ({ tenantId, pregunta, cobrador, intentConfig }) => {
  const context = await resolveClienteContext({ pregunta, tenantId, cobrador, intentConfig });

  if (context.multiple) {
    return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
  }

  if (!context.cliente) {
    if (context.searchType === 'missing') {
      return buildMissingClientResponse(context);
    }

    return {
      manejada: true,
      respuesta: context.searchType === 'cedula'
        ? 'No encontre un cliente con esa cedula en tu cartera.'
        : 'No encontre ese cliente en tu cartera.'
    };
  }

  const pago = await findUltimoPagoCliente({ tenantId, clienteId: context.cliente._id });
  if (!pago) {
    return { manejada: true, respuesta: `No encontre pagos registrados para ${context.cliente.nombre}.` };
  }

  return {
    manejada: true,
    respuesta: `El ultimo pago de ${context.cliente.nombre} fue de ${formatMoney(pago.monto)} el ${formatDate(pago.fecha)}.`
  };
};

const handlePendientesIntent = async ({ tenantId, pregunta, cobrador }) => {
  const hasSpecificClient = Boolean(extractCedula(pregunta) || extractExplicitName(pregunta));

  if (hasSpecificClient) {
    return handleSaldoIntent({
      tenantId,
      pregunta,
      cobrador,
      intentConfig: { intent: 'saldo' }
    });
  }

  const query = await buildScopedPrestamoQuery({
    tenantId,
    cobrador,
    estados: ['activo', 'vencido']
  });

  if (!query) {
    return {
      manejada: true,
      respuesta: 'No hay pagos pendientes registrados para tu cartera.'
    };
  }

  const prestamos = await Prestamo.find(query)
    .populate('clienteId', 'nombre cedula')
    .sort({ createdAt: -1 })
    .lean();

  const pendientes = prestamos
    .map((prestamo) => ({
      prestamo,
      saldoPendiente: getSaldoPendiente(prestamo)
    }))
    .filter((item) => item.saldoPendiente > 0)
    .sort((a, b) => b.saldoPendiente - a.saldoPendiente)
    .slice(0, MAX_RESULTS);

  if (!pendientes.length) {
    return {
      manejada: true,
      respuesta: cobrador?._id
        ? 'No hay pagos pendientes registrados para tu cartera.'
        : 'No hay pagos pendientes registrados para esta oficina.'
    };
  }

  return {
    manejada: true,
    respuesta: [
      cobrador?._id ? 'Clientes con pagos pendientes en tu cartera:' : 'Clientes con pagos pendientes en esta oficina:',
      ...pendientes.map((item, index) => (
        `${index + 1}. ${item.prestamo.clienteId?.nombre || 'Cliente'} - Cedula ${item.prestamo.clienteId?.cedula || 'N/A'} - Saldo: ${formatMoney(item.saldoPendiente)} - Estado: ${item.prestamo.estado}`
      ))
    ].join('\n')
  };
};

const handlePrestamosIntent = async ({ tenantId, pregunta, cobrador }) => {
  const normalized = normalizeText(pregunta);
  const paidIntent = normalized.includes('pagado');
  const estados = paidIntent ? ['pagado'] : ['activo', 'vencido'];
  const query = await buildScopedPrestamoQuery({ tenantId, cobrador, estados });

  if (!query) {
    return {
      manejada: true,
      respuesta: paidIntent
        ? 'No hay prestamos pagados registrados para tu cartera.'
        : 'No hay prestamos activos registrados para tu cartera.'
    };
  }

  const prestamos = await Prestamo.find(query)
    .populate('clienteId', 'nombre cedula')
    .sort({ createdAt: -1 })
    .limit(MAX_RESULTS)
    .lean();

  if (!prestamos.length) {
    return {
      manejada: true,
      respuesta: paidIntent
        ? (cobrador?._id ? 'No hay prestamos pagados registrados para tu cartera.' : 'No hay prestamos pagados registrados para esta oficina.')
        : (cobrador?._id ? 'No hay prestamos activos registrados para tu cartera.' : 'No hay prestamos activos registrados para esta oficina.')
    };
  }

  return {
    manejada: true,
    respuesta: [
      paidIntent ? 'Prestamos pagados:' : 'Prestamos activos:',
      ...prestamos.map((prestamo, index) => (
        `${index + 1}. ${prestamo.clienteId?.nombre || 'Cliente'} - Saldo: ${formatMoney(getSaldoPendiente(prestamo))} - Estado: ${prestamo.estado}`
      ))
    ].join('\n')
  };
};

const handlePagosHoyIntent = async ({ tenantId, cobrador }) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const query = {
    tenantId,
    fecha: { $gte: start, $lte: end }
  };

  if (cobrador?._id) {
    query.registradoPor = cobrador._id;
  }

  const pagos = await Pago.find(query)
    .sort({ fecha: -1, createdAt: -1 })
    .limit(MAX_RESULTS)
    .populate('clienteId', 'nombre cedula')
    .lean();

  if (!pagos.length) {
    return {
      manejada: true,
      respuesta: cobrador?._id
        ? 'No tienes pagos registrados hoy.'
        : 'No hay pagos registrados hoy en esta oficina.'
    };
  }

  const total = pagos.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);

  return {
    manejada: true,
    respuesta: [
      cobrador?._id
        ? `Hoy llevas ${pagos.length} pagos por ${formatMoney(total)}.`
        : `Hoy hay ${pagos.length} pagos registrados por ${formatMoney(total)}.`,
      ...pagos.map((pago, index) => (
        `${index + 1}. ${pago.clienteId?.nombre || 'Cliente'} - ${formatMoney(pago.monto)} - ${formatDate(pago.fecha)}`
      ))
    ].join('\n')
  };
};

const handleMorososIntent = async ({ tenantId, cobrador }) => {
  const query = await buildScopedPrestamoQuery({
    tenantId,
    cobrador,
    estados: ['activo', 'vencido']
  });

  if (!query) {
    return {
      manejada: true,
      respuesta: 'No tienes clientes morosos registrados.'
    };
  }

  const now = new Date();
  const prestamos = await Prestamo.find(query)
    .populate('clienteId', 'nombre cedula')
    .sort({ fechaVencimiento: 1 })
    .lean();

  const morosos = prestamos
    .filter((prestamo) => getSaldoPendiente(prestamo) > 0 && new Date(prestamo.fechaVencimiento) < now)
    .slice(0, MAX_RESULTS);

  if (!morosos.length) {
    return {
      manejada: true,
      respuesta: cobrador?._id
        ? 'No tienes clientes morosos registrados.'
        : 'No hay clientes morosos registrados en esta oficina.'
    };
  }

  return {
    manejada: true,
    respuesta: [
      cobrador?._id ? 'Clientes morosos de tu cartera:' : 'Clientes morosos de esta oficina:',
      ...morosos.map((prestamo, index) => (
        `${index + 1}. ${prestamo.clienteId?.nombre || 'Cliente'} - Cedula ${prestamo.clienteId?.cedula || 'N/A'} - Saldo: ${formatMoney(getSaldoPendiente(prestamo))} - Vence: ${formatDate(prestamo.fechaVencimiento)}`
      ))
    ].join('\n')
  };
};

const handleResumenIntent = async ({ tenantId, cobrador }) => {
  const query = await buildScopedPrestamoQuery({
    tenantId,
    cobrador,
    estados: ['activo', 'vencido']
  });

  if (!query) {
    return {
      manejada: true,
      respuesta: 'No hay informacion operativa para mostrar en este momento.'
    };
  }

  const [prestamos, pagosHoy] = await Promise.all([
    Prestamo.find(query).lean(),
    Pago.find({
      tenantId,
      ...(cobrador?._id ? { registradoPor: cobrador._id } : {}),
      fecha: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999))
      }
    }).lean()
  ]);

  const activos = prestamos.filter((prestamo) => ['activo', 'vencido'].includes(prestamo.estado)).length;
  const cartera = prestamos.reduce((sum, prestamo) => sum + getSaldoPendiente(prestamo), 0);
  const morosos = prestamos.filter((prestamo) => getSaldoPendiente(prestamo) > 0 && new Date(prestamo.fechaVencimiento) < new Date()).length;
  const totalPagosHoy = pagosHoy.reduce((sum, pago) => sum + Number(pago.monto || 0), 0);

  return {
    manejada: true,
    respuesta: [
      cobrador?._id ? 'Resumen de tu cartera:' : 'Resumen de la oficina:',
      `Prestamos activos: ${activos}.`,
      `Cartera pendiente: ${formatMoney(cartera)}.`,
      `Clientes morosos: ${morosos}.`,
      `Pagos registrados hoy: ${pagosHoy.length} por ${formatMoney(totalPagosHoy)}.`
    ].join(' ')
  };
};

const processIntent = async ({ intentConfig, tenantId, pregunta, cobrador }) => {
  if (intentConfig.intent === 'saldo') {
    return handleSaldoIntent({ tenantId, pregunta, cobrador, intentConfig });
  }

  if (intentConfig.intent === 'cuotas') {
    return handleCuotasIntent({ tenantId, pregunta, cobrador, intentConfig });
  }

  if (intentConfig.intent === 'historial') {
    return handleHistorialIntent({ tenantId, pregunta, cobrador, intentConfig });
  }

  if (intentConfig.intent === 'pendientes') {
    return handlePendientesIntent({ tenantId, pregunta, cobrador, intentConfig });
  }

  if (intentConfig.intent === 'prestamos_activos' || intentConfig.intent === 'prestamos_pagados') {
    return handlePrestamosIntent({ tenantId, pregunta, cobrador, intentConfig });
  }

  if (intentConfig.intent === 'ultimo_pago') {
    return handleUltimoPagoIntent({ tenantId, pregunta, cobrador, intentConfig });
  }

  if (intentConfig.intent === 'pagos_hoy') {
    return handlePagosHoyIntent({ tenantId, cobrador });
  }

  if (intentConfig.intent === 'clientes_morosos') {
    return handleMorososIntent({ tenantId, cobrador });
  }

  if (intentConfig.intent === 'resumen_oficina') {
    return handleResumenIntent({ tenantId, cobrador });
  }

  return { manejada: false };
};

const procesarPreguntaOperativa = async ({
  pregunta,
  tenantId,
  cobrador
}) => {
  const normalizedQuestion = String(pregunta || '').trim();
  let intentConfig = detectIntent(normalizedQuestion);

  if (!intentConfig) {
    const normalized = normalizeText(normalizedQuestion);
    const hasClientNarrative = /^[a-z]+\s+(esta|tiene)\b/.test(normalized) && /\b(mora|atrasad)/.test(normalized);
    const hasClientEntity = Boolean(extractCedula(normalizedQuestion) || hasClientNarrative);

    if (hasClientEntity && (normalized.includes('mora') || normalized.includes('atrasad'))) {
      intentConfig = { intent: 'historial' };
    }
  }

  console.log('Telegram IA operativa | tenantId:', tenantId);
  console.log('Telegram IA operativa | cobrador:', cobrador ? {
    id: String(cobrador._id),
    nombre: cobrador.nombre
  } : null);
  console.log('Telegram IA operativa | pregunta:', normalizedQuestion);
  console.log('Telegram IA operativa | intencion detectada:', intentConfig?.intent || 'ninguna');

  if (!intentConfig) {
    return { manejada: false };
  }

  try {
    const resultado = await processIntent({
      intentConfig,
      tenantId,
      pregunta: normalizedQuestion,
      cobrador
    });

    console.log('Telegram IA operativa | respuesta generada:', resultado?.respuesta || 'sin respuesta');
    return resultado;
  } catch (error) {
    console.error('Telegram IA operativa | error:', error.message);
    console.error(error.stack);
    throw error;
  }
};

module.exports = {
  detectIntent,
  extractCedula,
  extractExplicitName,
  normalizeText,
  procesarPreguntaOperativa
};
