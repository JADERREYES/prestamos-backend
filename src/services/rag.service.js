const { generarRespuestaIA } = require('./aiResponse.service');
const { buscarDocumentosSimilares } = require('./vectorSearch.service');

const responderConRAG = async (pregunta, opciones = {}) => {
  const preguntaNormalizada = String(pregunta || '').trim();

  if (!preguntaNormalizada) {
    const error = new Error('pregunta es requerida');
    error.code = 'RAG_QUESTION_REQUIRED';
    throw error;
  }

  if (!opciones.tenantId && !opciones.allowGlobal) {
    const error = new Error('tenantId es obligatorio para responder con IA por empresa');
    error.code = 'TENANT_ID_REQUIRED';
    throw error;
  }

  const documentos = await buscarDocumentosSimilares(preguntaNormalizada, opciones);
  const respuesta = await generarRespuestaIA({
    pregunta: preguntaNormalizada,
    documentos
  });

  return {
    pregunta: preguntaNormalizada,
    respuesta,
    documentos
  };
};

module.exports = {
  responderConRAG
};
