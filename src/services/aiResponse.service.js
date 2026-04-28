const { getOpenAIClient } = require('./embedding.service');

const getChatModel = () => process.env.OPENAI_CHAT_MODEL || process.env.AI_MODEL || 'gpt-4.1-mini';

const generarRespuestaIA = async ({ pregunta, documentos }) => {
  const preguntaNormalizada = String(pregunta || '').trim();
  const documentosLista = Array.isArray(documentos) ? documentos : [];

  if (!preguntaNormalizada) {
    const error = new Error('La pregunta es requerida para generar la respuesta');
    error.code = 'AI_QUESTION_REQUIRED';
    throw error;
  }

  if (!documentosLista.length) {
    return 'No tengo informacion suficiente en los documentos de esta empresa para responder esa pregunta.';
  }

  const contexto = documentosLista
    .map((documento, index) => [
      `Documento ${index + 1}`,
      `Titulo: ${documento.titulo || 'Sin titulo'}`,
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
          content: 'Eres un asistente del sistema de prestamos. Responde de forma clara, breve y util. Usa solo el contexto entregado. Si el contexto no contiene la respuesta, indica que no tienes informacion suficiente.'
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

    return respuesta;
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
