const { generarRespuestaIA } = require('./aiResponse.service');
const {
  buscarDocumentosSimilares,
  contarDocumentosPorTenant
} = require('./vectorSearch.service');

const responderConRAG = async (pregunta, opciones = {}) => {
  const preguntaNormalizada = String(pregunta || '').trim();

  if (!preguntaNormalizada) {
    const error = new Error('pregunta es requerida');
    error.code = 'RAG_QUESTION_REQUIRED';
    throw error;
  }

  if (!opciones.tenantId) {
    const error = new Error('tenantId es obligatorio para responder con IA por empresa');
    error.code = 'TENANT_ID_REQUIRED';
    throw error;
  }

  const totalDocumentosTenant = await contarDocumentosPorTenant(opciones.tenantId);

  if (!totalDocumentosTenant) {
    return {
      pregunta: preguntaNormalizada,
      respuesta: 'Todavia no tengo documentos cargados para esta empresa. Un administrador debe subir el manual o las politicas en PDF.',
      documentos: []
    };
  }

  const documentos = await buscarDocumentosSimilares(preguntaNormalizada, opciones);

  if (!documentos.length) {
    return {
      pregunta: preguntaNormalizada,
      respuesta: 'No encontre esa informacion en los documentos de esta empresa.',
      documentos: []
    };
  }

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
