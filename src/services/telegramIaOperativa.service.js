const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');
const Pago = require('../models/Pago');

const MAX_RESULTS = 5;

const normalizeText = (text) => String(text || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

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

const INTENT_PATTERNS = [
  { intent: 'ultimo_pago', patterns: ['ultimo pago', 'ultimo abono', 'cuando pago', 'fecha de pago'] },
  { intent: 'cuotas', patterns: ['cuantas cuotas', 'cuotas pagadas', 'cuotas pendientes', 'cuantas le faltan', 'cuota', 'cuotas'] },
  { intent: 'pendientes', patterns: ['pagos pendientes', 'cobros pendientes', 'cartera pendiente', 'quien debe', 'clientes pendientes', 'pendientes'] },
  { intent: 'prestamos', patterns: ['prestamo activo', 'prestamos activos', 'credito activo', 'creditos activos', 'credito pagado', 'creditos pagados', 'prestamos pagados'] },
  { intent: 'saldo', patterns: ['saldo pendiente', 'cuanto debe', 'saldo', 'deuda', 'debe', 'pendiente'] }
];

const detectIntent = (pregunta) => {
  const normalized = normalizeText(pregunta);

  for (const config of INTENT_PATTERNS) {
    if (config.patterns.some((pattern) => normalized.includes(pattern))) {
      return config.intent;
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
  const phrases = [
    'ultimo pago de',
    'ultimo pago',
    'ultimo abono de',
    'ultimo abono',
    'cuando pago',
    'fecha de pago de',
    'fecha de pago',
    'cuantas cuotas tiene el cliente',
    'cuantas cuotas tiene la cedula',
    'cuantas cuotas tiene',
    'cuantas le faltan a',
    'cuotas pendientes de',
    'cuotas pagadas de',
    'saldo pendiente de',
    'saldo de',
    'deuda de',
    'cuanto debe el cliente',
    'cuanto debe la cedula',
    'cuanto debe',
    'este cliente tiene cobros pendientes',
    'este cliente tiene pagos pendientes',
    'cliente',
    'cedula',
    'saldo',
    'deuda',
    'debe',
    'cuotas',
    'cuota',
    'pendientes',
    'pagos pendientes de',
    'pagos pendientes',
    'cobros pendientes de',
    'cobros pendientes',
    'prestamos activos de',
    'prestamos activos',
    'creditos activos de',
    'creditos activos',
    'creditos pagados de',
    'creditos pagados',
    'prestamos pagados'
  ];

  phrases.forEach((phrase) => {
    cleaned = cleaned.replaceAll(phrase, ' ');
  });

  cleaned = cleaned.replace(/\d{5,30}/g, ' ');
  cleaned = cleaned.replace(/[^\p{L}\s]/gu, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
};

const findClienteByCedula = async ({ tenantId, cedula }) => Cliente.findOne({
  tenantId,
  cedula: String(cedula || '').trim(),
  activo: true
}).lean();

const findClientesByNombre = async ({ tenantId, name }) => Cliente.find({
  tenantId,
  activo: true,
  nombre: { $regex: name, $options: 'i' }
})
  .select('nombre cedula telefono tenantId createdAt')
  .sort({ nombre: 1 })
  .limit(MAX_RESULTS + 1)
  .lean();

const findPrestamosByCliente = async ({ tenantId, clienteId }) => Prestamo.find({
  tenantId,
  clienteId
})
  .sort({ createdAt: -1 })
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
  'Encontré varios clientes parecidos. Escribe la cédula para mayor precisión.',
  ...clientes.slice(0, MAX_RESULTS).map((cliente, index) => `${index + 1}. ${cliente.nombre} - Cédula ${cliente.cedula}`)
].join('\n');

const resolveClienteContext = async ({ pregunta, tenantId }) => {
  const cedula = extractCedula(pregunta);

  if (cedula) {
    const cliente = await findClienteByCedula({ tenantId, cedula });
    console.log('Telegram IA operativa | tipo búsqueda: cédula');
    console.log('Telegram IA operativa | cédula extraída:', cedula);
    console.log('Telegram IA operativa | cliente encontrado:', cliente ? {
      id: String(cliente._id),
      nombre: cliente.nombre,
      cedula: cliente.cedula
    } : null);
    return {
      searchType: 'cedula',
      cedula,
      cliente,
      multiple: false
    };
  }

  const possibleName = stripNameNoise(pregunta);
  if (!possibleName) {
    console.log('Telegram IA operativa | tipo búsqueda: general');
    return {
      searchType: 'general',
      cliente: null,
      multiple: false
    };
  }

  const matches = await findClientesByNombre({ tenantId, name: possibleName });
  console.log('Telegram IA operativa | tipo búsqueda: nombre');
  console.log('Telegram IA operativa | nombre extraído:', possibleName);
  console.log('Telegram IA operativa | coincidencias:', matches.length);
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

const handleSaldoIntent = async ({ tenantId, pregunta }) => {
  const context = await resolveClienteContext({ pregunta, tenantId });

  if (context.multiple) {
    return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
  }

  if (!context.cliente) {
    return {
      manejada: true,
      respuesta: context.searchType === 'cedula'
        ? 'No encontré un cliente con esa cédula en tu oficina.'
        : 'No encontré ese cliente en tu oficina.'
    };
  }

  const prestamos = await findPrestamosByCliente({ tenantId, clienteId: context.cliente._id });
  console.log('Telegram IA operativa | préstamos encontrados para saldo:', prestamos.length);
  if (!prestamos.length) {
    return { manejada: true, respuesta: 'El cliente no tiene créditos activos.' };
  }

  const saldoTotal = prestamos.reduce((sum, prestamo) => sum + getSaldoPendiente(prestamo), 0);
  const prestamoReferencia = selectReferencePrestamo(prestamos);
  const ultimoPago = await findUltimoPagoCliente({ tenantId, clienteId: context.cliente._id });
  console.log('Telegram IA operativa | préstamo referencia saldo:', prestamoReferencia ? {
    id: String(prestamoReferencia._id),
    estado: prestamoReferencia.estado
  } : null);

  if (saldoTotal <= 0) {
    return {
      manejada: true,
      respuesta: `El cliente ${context.cliente.nombre} no tiene saldo pendiente. Su crédito aparece como ${prestamoReferencia?.estado || 'pagado'}.`
    };
  }

  const parts = [
    `El cliente ${context.cliente.nombre}, cédula ${context.cliente.cedula}, tiene un saldo pendiente de ${formatMoney(saldoTotal)}.`,
    `El crédito está ${prestamoReferencia?.estado || 'activo'}.`
  ];

  if (prestamoReferencia?.capital !== undefined) {
    parts.push(`Monto inicial: ${formatMoney(prestamoReferencia.capital)}.`);
  }

  if (ultimoPago) {
    parts.push(`Último pago registrado: ${formatMoney(ultimoPago.monto)} el ${formatDate(ultimoPago.fecha)}.`);
  }

  return {
    manejada: true,
    respuesta: parts.join(' ')
  };
};

const handleCuotasIntent = async ({ tenantId, pregunta }) => {
  const context = await resolveClienteContext({ pregunta, tenantId });

  if (context.multiple) {
    return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
  }

  if (!context.cliente) {
    return {
      manejada: true,
      respuesta: context.searchType === 'cedula'
        ? 'No encontré un cliente con esa cédula en tu oficina.'
        : 'No encontré ese cliente en tu oficina.'
    };
  }

  const prestamos = await findPrestamosByCliente({ tenantId, clienteId: context.cliente._id });
  const prestamo = selectReferencePrestamo(prestamos);
  console.log('Telegram IA operativa | préstamos encontrados para cuotas:', prestamos.length);
  console.log('Telegram IA operativa | préstamo referencia cuotas:', prestamo ? {
    id: String(prestamo._id),
    estado: prestamo.estado,
    plazo: prestamo.plazo
  } : null);

  if (!prestamo) {
    return { manejada: true, respuesta: 'El cliente no tiene créditos activos.' };
  }

  if (!prestamo.plazo) {
    return {
      manejada: true,
      respuesta: 'El crédito del cliente existe, pero el sistema no tiene registrado el número total de cuotas.'
    };
  }

  const totalCuotas = Number(prestamo.plazo || 0);
  const cuotasPagadas = getCuotasPagadasEstimadas(prestamo);
  const cuotasPendientes = getCuotasPendientesEstimadas(prestamo);
  const valorCuota = getValorCuota(prestamo);
  const saldoPendiente = getSaldoPendiente(prestamo);
  const multipleActivos = prestamos.filter((item) => ['activo', 'vencido'].includes(item.estado)).length > 1;

  const parts = [
    `El cliente ${context.cliente.nombre} tiene un crédito de ${totalCuotas} cuotas.`
  ];

  if (cuotasPagadas !== null) {
    parts.push(`Ha pagado ${cuotasPagadas} cuotas`);
  }

  if (cuotasPendientes !== null) {
    parts.push(`y le faltan ${cuotasPendientes}.`);
  } else {
    parts.push('');
  }

  if (valorCuota !== null) {
    parts.push(`Valor de cuota estimado: ${formatMoney(valorCuota)}.`);
  }

  parts.push(`Saldo pendiente: ${formatMoney(saldoPendiente)}.`);
  parts.push(`Estado del crédito: ${prestamo.estado}.`);

  if (multipleActivos) {
    parts.push('Tomé como referencia el crédito activo más reciente del cliente.');
  }

  return {
    manejada: true,
    respuesta: parts.join(' ').replace(/\s+\./g, '.')
  };
};

const handlePendientesIntent = async ({ tenantId, pregunta }) => {
  const context = await resolveClienteContext({ pregunta, tenantId });

  if (context.searchType !== 'general') {
    if (context.multiple) {
      return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
    }

    if (!context.cliente) {
      return {
        manejada: true,
        respuesta: context.searchType === 'cedula'
          ? 'No encontré un cliente con esa cédula en tu oficina.'
          : 'No encontré ese cliente en tu oficina.'
      };
    }

    const prestamos = await findPrestamosByCliente({ tenantId, clienteId: context.cliente._id });
    const saldo = prestamos.reduce((sum, prestamo) => sum + getSaldoPendiente(prestamo), 0);

    if (saldo <= 0) {
      return {
        manejada: true,
        respuesta: `El cliente ${context.cliente.nombre} no tiene cobros pendientes.`
      };
    }

    return {
      manejada: true,
      respuesta: `Sí. El cliente ${context.cliente.nombre}, cédula ${context.cliente.cedula}, tiene un saldo pendiente de ${formatMoney(saldo)}.`
    };
  }

  const prestamos = await Prestamo.find({
    tenantId,
    estado: { $in: ['activo', 'vencido'] }
  })
    .populate('clienteId', 'nombre cedula')
    .sort({ createdAt: -1 })
    .lean();
  console.log('Telegram IA operativa | resultados pendientes:', prestamos.length);

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
      respuesta: 'No hay pagos pendientes registrados para esta oficina.'
    };
  }

  return {
    manejada: true,
    respuesta: [
      'Clientes con pagos pendientes:',
      ...pendientes.map((item, index) => (
        `${index + 1}. ${item.prestamo.clienteId?.nombre || 'Cliente'} - Cédula ${item.prestamo.clienteId?.cedula || 'N/A'} - Saldo: ${formatMoney(item.saldoPendiente)} - Estado: ${item.prestamo.estado}`
      ))
    ].join('\n')
  };
};

const handlePrestamosIntent = async ({ tenantId, pregunta }) => {
  const normalized = normalizeText(pregunta);
  const paidIntent = normalized.includes('pagado');
  const estados = paidIntent ? ['pagado'] : ['activo', 'vencido'];

  const prestamos = await Prestamo.find({
    tenantId,
    estado: { $in: estados }
  })
    .populate('clienteId', 'nombre cedula')
    .sort({ createdAt: -1 })
    .limit(MAX_RESULTS)
    .lean();
  console.log('Telegram IA operativa | resultados préstamos:', prestamos.length);

  if (!prestamos.length) {
    return {
      manejada: true,
      respuesta: paidIntent
        ? 'No hay préstamos pagados registrados para esta oficina.'
        : 'No hay préstamos activos registrados para esta oficina.'
    };
  }

  const title = paidIntent ? 'Préstamos pagados:' : 'Préstamos activos:';

  return {
    manejada: true,
    respuesta: [
      title,
      ...prestamos.map((prestamo, index) => (
        `${index + 1}. ${prestamo.clienteId?.nombre || 'Cliente'} - Saldo: ${formatMoney(getSaldoPendiente(prestamo))} - Estado: ${prestamo.estado}`
      ))
    ].join('\n')
  };
};

const handleUltimoPagoIntent = async ({ tenantId, pregunta }) => {
  const context = await resolveClienteContext({ pregunta, tenantId });

  if (context.multiple) {
    return { manejada: true, respuesta: buildMultipleMatchesResponse(context.matches) };
  }

  if (!context.cliente) {
    return {
      manejada: true,
      respuesta: context.searchType === 'cedula'
        ? 'No encontré un cliente con esa cédula en tu oficina.'
        : 'No encontré ese cliente en tu oficina.'
    };
  }

  const pago = await findUltimoPagoCliente({ tenantId, clienteId: context.cliente._id });
  console.log('Telegram IA operativa | último pago encontrado:', pago ? {
    id: String(pago._id),
    monto: pago.monto,
    fecha: pago.fecha
  } : null);
  if (!pago) {
    return { manejada: true, respuesta: 'No encontré pagos registrados para ese cliente.' };
  }

  return {
    manejada: true,
    respuesta: `El último pago de ${context.cliente.nombre} fue de ${formatMoney(pago.monto)} el ${formatDate(pago.fecha)}.`
  };
};

const processIntent = async ({ intent, tenantId, pregunta }) => {
  if (intent === 'saldo') {
    return handleSaldoIntent({ tenantId, pregunta });
  }

  if (intent === 'cuotas') {
    return handleCuotasIntent({ tenantId, pregunta });
  }

  if (intent === 'pendientes') {
    return handlePendientesIntent({ tenantId, pregunta });
  }

  if (intent === 'prestamos') {
    return handlePrestamosIntent({ tenantId, pregunta });
  }

  if (intent === 'ultimo_pago') {
    return handleUltimoPagoIntent({ tenantId, pregunta });
  }

  return { manejada: false };
};

const procesarPreguntaOperativa = async ({
  pregunta,
  tenantId,
  cobrador
}) => {
  const normalizedQuestion = String(pregunta || '').trim();
  const intent = detectIntent(normalizedQuestion);

  console.log('Telegram IA operativa | tenantId:', tenantId);
  console.log('Telegram IA operativa | cobrador:', cobrador ? {
    id: String(cobrador._id),
    nombre: cobrador.nombre
  } : null);
  console.log('Telegram IA operativa | pregunta:', normalizedQuestion);
  console.log('Telegram IA operativa | intención detectada:', intent || 'ninguna');

  if (!intent) {
    return { manejada: false };
  }

  try {
    const resultado = await processIntent({
      intent,
      tenantId,
      pregunta: normalizedQuestion
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
  procesarPreguntaOperativa
};
