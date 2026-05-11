const { getOpenAIClient } = require('./embedding.service');

const getChatModel = () => process.env.OPENAI_CHAT_MODEL || process.env.AI_MODEL || 'gpt-4.1-mini';

const buildDocumentoReferencia = (documento) => {
  const fileName = documento?.fileName || documento?.metadata?.originalName || documento?.titulo || 'Documento sin titulo';
  const categoria = documento?.categoria || 'general';
  return `${fileName} (${categoria})`;
};

const generarRespuestaIA = async ({ pregunta, documentos }) => {
  const preguntaNormalizada = String(pregunta || '').trim();
  const documentosLista = Array.isArray(documentos) ? documentos : [];

  if (!preguntaNormalizada) {
    const error = new Error('La pregunta es requerida para generar la respuesta');
    error.code = 'AI_QUESTION_REQUIRED';
    throw error;
  }

  if (!documentosLista.length) {
    return 'Todavia no tengo documentos cargados para esta empresa. Un administrador debe subir el manual o las politicas en PDF.';
  }

  const contexto = documentosLista
    .map((documento, index) => [
      `Documento ${index + 1}`,
      `Titulo: ${documento.titulo || 'Sin titulo'}`,
      `Archivo: ${documento.fileName || documento.metadata?.originalName || 'Sin archivo'}`,
      `Categoria: ${documento.categoria || 'general'}`,
      `Fuente: ${documento.fuente || 'manual'}`,
      `Contenido: ${documento.contenido || ''}`
    ].join('\n'))
    .join('\n\n');

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: getChatModel(),
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'Eres un asistente operativo y documental de un sistema de prestamos.',
            'Responde de forma clara, breve y util para Telegram.',
            'Usa solo el contexto entregado.',
            'No inventes politicas, requisitos ni procedimientos.',
            'Si el contexto no contiene la respuesta, responde exactamente: "No encontre esa informacion en los documentos de esta empresa."',
            'Si respondes con informacion encontrada, menciona al final una referencia corta con el nombre del archivo o documento.'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Pregunta: ${preguntaNormalizada}\n\nContexto:\n${contexto}`
        }
      ]
    });

    const respuesta = response?.choices?.[0]?.message?.content?.trim();

    if (!respuesta) {
      const error = new Error('OpenAI no devolvio una respuesta valida');
      error.code = 'AI_EMPTY_RESPONSE';
      throw error;
    }

    if (/no tengo informacion suficiente/i.test(respuesta)) {
      return 'No encontre esa informacion en los documentos de esta empresa.';
    }

    if (/no encontre esa informacion en los documentos de esta empresa/i.test(respuesta)) {
      return 'No encontre esa informacion en los documentos de esta empresa.';
    }

    const referencias = [...new Set(documentosLista.slice(0, 3).map(buildDocumentoReferencia))];

    if (!referencias.length) {
      return respuesta;
    }

    return `${respuesta}\n\nFuente: ${referencias.join(' | ')}`;
  } catch (error) {
    if (error.code) throw error;

    const wrappedError = new Error(`Error generando respuesta IA: ${error.message}`);
    wrappedError.code = 'AI_RESPONSE_FAILED';
    throw wrappedError;
  }
};

module.exports = {
  generarRespuestaIA,
  getChatModel
};
