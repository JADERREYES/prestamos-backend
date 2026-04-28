const mongoose = require('mongoose');
const { getDocumentoVectorialModel } = require('../models/DocumentoVectorial');
const { crearEmbedding } = require('./embedding.service');

const getTopK = (topK) => {
  const defaultTopK = Number(process.env.VECTOR_TOP_K || 5);
  const parsed = Number(topK || defaultTopK);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultTopK;
  }

  return parsed;
};

const normalizeTenantId = (tenantId) => {
  if (!tenantId) return null;
  return String(tenantId).trim().toLowerCase();
};

const guardarDocumentoVectorial = async ({
  titulo,
  contenido,
  categoria,
  fuente,
  tenantId,
  metadata,
  allowGlobal = false
}) => {
  const tituloNormalizado = String(titulo || '').trim();
  const contenidoNormalizado = String(contenido || '').trim();

  if (!tituloNormalizado) {
    const error = new Error('titulo es requerido');
    error.code = 'VECTOR_TITLE_REQUIRED';
    throw error;
  }

  if (!contenidoNormalizado) {
    const error = new Error('contenido es requerido');
    error.code = 'VECTOR_CONTENT_REQUIRED';
    throw error;
  }

  if (mongoose.connection.readyState !== 1) {
    const error = new Error('MongoDB no esta conectado');
    error.code = 'MONGODB_NOT_CONNECTED';
    throw error;
  }

  const normalizedTenantId = normalizeTenantId(tenantId);

  if (!normalizedTenantId && !allowGlobal) {
    const error = new Error('tenantId es obligatorio para documentos de IA por empresa');
    error.code = 'TENANT_ID_REQUIRED';
    throw error;
  }

  const embedding = await crearEmbedding(contenidoNormalizado);
  const DocumentoVectorial = getDocumentoVectorialModel();

  const documento = await DocumentoVectorial.create({
    titulo: tituloNormalizado,
    contenido: contenidoNormalizado,
    categoria: String(categoria || 'general').trim(),
    fuente: String(fuente || 'manual').trim(),
    tenantId: normalizedTenantId,
    metadata: metadata || {},
    embedding
  });

  return documento;
};

const buscarDocumentosSimilares = async (pregunta, opciones = {}) => {
  const preguntaNormalizada = String(pregunta || '').trim();

  if (!preguntaNormalizada) {
    const error = new Error('pregunta es requerida');
    error.code = 'VECTOR_QUESTION_REQUIRED';
    throw error;
  }

  if (mongoose.connection.readyState !== 1) {
    const error = new Error('MongoDB no esta conectado');
    error.code = 'MONGODB_NOT_CONNECTED';
    throw error;
  }

  const embeddingPregunta = await crearEmbedding(preguntaNormalizada);
  const DocumentoVectorial = getDocumentoVectorialModel();
  const topK = getTopK(opciones.topK || opciones.limite);
  const normalizedTenantId = normalizeTenantId(opciones.tenantId);
  const allowGlobal = Boolean(opciones.allowGlobal);

  if (!normalizedTenantId && !allowGlobal) {
    const error = new Error('tenantId es obligatorio para busquedas de IA por empresa');
    error.code = 'TENANT_ID_REQUIRED';
    throw error;
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: process.env.VECTOR_INDEX_NAME || 'vector_index',
        path: 'embedding',
        queryVector: embeddingPregunta,
        numCandidates: 100,
        limit: topK,
        ...(normalizedTenantId ? {
          filter: {
            tenantId: normalizedTenantId
          }
        } : {})
      }
    },
    {
      $project: {
        titulo: 1,
        contenido: 1,
        categoria: 1,
        fuente: 1,
        tenantId: 1,
        metadata: 1,
        createdAt: 1,
        updatedAt: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    }
  ];

  const resultados = await DocumentoVectorial.aggregate(pipeline);
  return resultados;
};

const listarDocumentosPorTenant = async (tenantId) => {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const DocumentoVectorial = getDocumentoVectorialModel();

  return DocumentoVectorial.find({ tenantId: normalizedTenantId })
    .select('-embedding')
    .sort({ createdAt: -1 })
    .lean();
};

const eliminarDocumentoPorTenant = async (tenantId, documentoId) => {
  const normalizedTenantId = normalizeTenantId(tenantId);

  if (!mongoose.Types.ObjectId.isValid(documentoId)) {
    const error = new Error('documentoId no es un ObjectId valido');
    error.code = 'INVALID_DOCUMENT_ID';
    throw error;
  }

  const DocumentoVectorial = getDocumentoVectorialModel();

  return DocumentoVectorial.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(documentoId),
    tenantId: normalizedTenantId
  }).lean();
};

module.exports = {
  eliminarDocumentoPorTenant,
  guardarDocumentoVectorial,
  buscarDocumentosSimilares,
  listarDocumentosPorTenant,
  normalizeTenantId
};
