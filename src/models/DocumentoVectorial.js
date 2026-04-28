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
    required: false,
    default: null
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
