const mongoose = require('mongoose');

const vectorDbName = process.env.VECTOR_DB_NAME || 'prestamos';
const vectorCollectionName = process.env.VECTOR_COLLECTION_NAME || 'documentos_vectoriales';

const documentoVectorialSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  contenido: {
    type: String,
    required: true,
    trim: true
  },
  categoria: {
    type: String,
    default: 'general',
    trim: true
  },
  fuente: {
    type: String,
    default: 'manual',
    trim: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  documentGroupId: {
    type: String,
    default: null,
    index: true,
    trim: true
  },
  sourceType: {
    type: String,
    default: 'text',
    trim: true
  },
  fileName: {
    type: String,
    default: '',
    trim: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  uploadedByRole: {
    type: String,
    default: '',
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  embedding: {
    type: [Number],
    required: true,
    default: []
  }
}, {
  timestamps: true
});

documentoVectorialSchema.index({ tenantId: 1, documentGroupId: 1, activo: 1 });
documentoVectorialSchema.index({ tenantId: 1, fileName: 1, activo: 1 });

const getDocumentoVectorialModel = () => {
  const vectorDb = mongoose.connection.useDb(vectorDbName, { useCache: true });

  if (vectorDb.models.DocumentoVectorial) {
    return vectorDb.models.DocumentoVectorial;
  }

  return vectorDb.model(
    'DocumentoVectorial',
    documentoVectorialSchema,
    vectorCollectionName
  );
};

module.exports = {
  getDocumentoVectorialModel
};
