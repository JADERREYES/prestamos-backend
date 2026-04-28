const OpenAI = require('openai');

let client;

const getOpenAIClient = () => {
  if (client) return client;

  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY no esta configurada en .env');
    error.code = 'OPENAI_API_KEY_MISSING';
    throw error;
  }

  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  return client;
};

const getEmbeddingModel = () => process.env.OPENAI_EMBEDDING_MODEL || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

const getExpectedDimensions = () => Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 1536);

const crearEmbedding = async (texto) => {
  const textoNormalizado = String(texto || '').trim();

  if (!textoNormalizado) {
    const error = new Error('El texto es requerido para generar el embedding');
    error.code = 'EMBEDDING_TEXT_REQUIRED';
    throw error;
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.embeddings.create({
      model: getEmbeddingModel(),
      input: textoNormalizado
    });

    const embedding = response?.data?.[0]?.embedding;

    if (!Array.isArray(embedding)) {
      const error = new Error('OpenAI no devolvio un embedding valido');
      error.code = 'INVALID_EMBEDDING_RESPONSE';
      throw error;
    }

    const expectedDimensions = getExpectedDimensions();
    if (expectedDimensions && embedding.length !== expectedDimensions) {
      const error = new Error(`El embedding tiene ${embedding.length} dimensiones y se esperaban ${expectedDimensions}`);
      error.code = 'EMBEDDING_DIMENSION_MISMATCH';
      throw error;
    }

    return embedding;
  } catch (error) {
    if (error.code) throw error;

    const wrappedError = new Error(`Error generando embedding: ${error.message}`);
    wrappedError.code = 'EMBEDDING_GENERATION_FAILED';
    throw wrappedError;
  }
};

module.exports = {
  crearEmbedding,
  getEmbeddingModel,
  getExpectedDimensions,
  getOpenAIClient
};
