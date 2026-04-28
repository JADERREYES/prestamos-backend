const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { responderConRAG } = require('../services/rag.service');
const Tenant = require('../models/Tenant');
const Admin = require('../models/Admin');
const { verifyToken } = require('../utils/jwt');
const {
  buscarDocumentosSimilares,
  eliminarDocumentoPorTenant,
  guardarDocumentoVectorial,
  listarDocumentosPorTenant,
  normalizeTenantId
} = require('../services/vectorSearch.service');

const router = express.Router();
const maxPdfSizeMb = Number(process.env.IA_PDF_MAX_SIZE_MB || 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxPdfSizeMb * 1024 * 1024
  }
});

// Se puede extraer este middleware a un archivo compartido cuando se unifique con superadmin.routes.js.
const requireSuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token no proporcionado' });
    }

    const decoded = verifyToken(token);
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Usuario no encontrado' });
    }

    if (admin.rol !== 'superadmin' && admin.rol !== 'superadministrador') {
      return res.status(403).json({ ok: false, error: 'No autorizado para gestionar documentos IA' });
    }

    req.user = admin;
    next();
  } catch (error) {
    console.error('IA | Error autenticando superadmin:', error.message);
    return res.status(401).json({ ok: false, error: 'Token invalido o expirado' });
  }
};

const normalizarTexto = (valor) => String(valor || '').replace(/\s+/g, ' ').trim();

const chunkText = (texto, options = {}) => {
  const chunkSize = Number(options.chunkSize || 1000);
  const overlap = Number(options.overlap || 150);
  const contenido = normalizarTexto(texto);

  if (!contenido) return [];

  const chunks = [];
  let start = 0;

  while (start < contenido.length) {
    let end = Math.min(start + chunkSize, contenido.length);

    if (end < contenido.length) {
      const lastSpace = contenido.lastIndexOf(' ', end);
      if (lastSpace > start + 200) {
        end = lastSpace;
      }
    }

    const chunk = contenido.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= contenido.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};

const getTenantByTenantId = async (tenantIdParam) => {
  const tenantId = normalizeTenantId(tenantIdParam);

  if (!tenantId) {
    const error = new Error('tenantId es requerido');
    error.statusCode = 400;
    throw error;
  }

  const tenant = await Tenant.findOne({ tenantId }).lean();

  if (tenant) {
    return tenant;
  }

  const adminTenant = await Admin.findOne({
    rol: { $in: ['admin', 'administrador'] },
    tenantId
  })
    .select('tenantId')
    .lean();

  if (adminTenant) {
    return {
      _id: null,
      nombre: tenantId,
      tenantId
    };
  }

  const error = new Error('Empresa/oficina no encontrada');
  error.statusCode = 404;
  throw error;
};

router.post('/documentos-vectoriales', async (req, res) => {
  try {
    const { titulo, contenido, categoria, fuente, tenantId, metadata, allowGlobal } = req.body;

    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ ok: false, error: 'titulo es requerido' });
    }

    if (!contenido || !String(contenido).trim()) {
      return res.status(400).json({ ok: false, error: 'contenido es requerido' });
    }

    console.log('IA | Guardando documento vectorial:', { titulo, categoria, fuente });

    const documento = await guardarDocumentoVectorial({
      titulo,
      contenido,
      categoria,
      fuente,
      tenantId,
      metadata,
      allowGlobal: Boolean(allowGlobal)
    });

    return res.status(201).json({
      ok: true,
      message: 'Documento vectorial guardado correctamente',
      documento: {
        id: documento._id,
        titulo: documento.titulo,
        contenido: documento.contenido,
        categoria: documento.categoria,
        fuente: documento.fuente,
        tenantId: documento.tenantId,
        metadata: documento.metadata,
        dimensiones: Array.isArray(documento.embedding) ? documento.embedding.length : 0,
        createdAt: documento.createdAt
      }
    });
  } catch (error) {
    console.error('IA | Error guardando documento vectorial:', error.message);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/buscar-vector', async (req, res) => {
  try {
    const { pregunta, topK, tenantId, allowGlobal } = req.body;

    if (!pregunta || !String(pregunta).trim()) {
      return res.status(400).json({ ok: false, error: 'pregunta es requerida' });
    }

    console.log('IA | Busqueda vectorial:', { pregunta, topK });

    const documentos = await buscarDocumentosSimilares(pregunta, {
      topK,
      tenantId,
      allowGlobal: Boolean(allowGlobal)
    });

    return res.json({
      ok: true,
      pregunta: String(pregunta).trim(),
      total: documentos.length,
      documentos
    });
  } catch (error) {
    console.error('IA | Error en busqueda vectorial:', error.message);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/preguntar', async (req, res) => {
  try {
    const { pregunta, topK, tenantId, allowGlobal } = req.body;

    if (!pregunta || !String(pregunta).trim()) {
      return res.status(400).json({ ok: false, error: 'pregunta es requerida' });
    }

    console.log('IA | Pregunta RAG:', { pregunta, topK });

    const resultado = await responderConRAG(pregunta, {
      topK,
      tenantId,
      allowGlobal: Boolean(allowGlobal)
    });

    return res.json({
      ok: true,
      ...resultado
    });
  } catch (error) {
    console.error('IA | Error en RAG:', error.message);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/tenants/:tenantId/documentos', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);
    const { titulo, contenido, categoria, fuente } = req.body;

    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ ok: false, error: 'titulo es requerido' });
    }

    if (!contenido || !String(contenido).trim()) {
      return res.status(400).json({ ok: false, error: 'contenido es requerido' });
    }

    console.log('IA | Guardando documento por tenant:', {
      tenantId: tenant._id,
      tenantKey: tenant.tenantId,
      titulo
    });

    const documento = await guardarDocumentoVectorial({
      titulo,
      contenido,
      categoria,
      fuente: fuente || 'texto_superadmin',
      tenantId: tenant.tenantId,
      metadata: {
        uploadedBy: req.user._id,
        uploadedByRole: req.user.rol,
        tipo: 'texto',
        tenantName: tenant.nombre,
        createdFrom: 'superadmin'
      }
    });

    return res.status(201).json({
      ok: true,
      message: 'Documento vectorial guardado correctamente',
      documento: {
        id: documento._id,
        titulo: documento.titulo,
        categoria: documento.categoria,
        fuente: documento.fuente,
        tenantId: documento.tenantId,
        dimensiones: Array.isArray(documento.embedding) ? documento.embedding.length : 0,
        createdAt: documento.createdAt
      }
    });
  } catch (error) {
    console.error('IA | Error guardando documento por tenant:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/tenants/:tenantId/documentos/pdf', requireSuperAdmin, upload.single('archivo'), async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);

    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'archivo es requerido' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ ok: false, error: 'El archivo debe ser un PDF' });
    }

    const parsed = await pdfParse(req.file.buffer);
    const extractedText = normalizarTexto(parsed?.text || '');

    if (!extractedText) {
      return res.status(400).json({ ok: false, error: 'El PDF no contiene texto extraible' });
    }

    const chunks = chunkText(extractedText, {
      chunkSize: 1000,
      overlap: 150
    });

    if (!chunks.length) {
      return res.status(400).json({ ok: false, error: 'No fue posible dividir el PDF en bloques utiles' });
    }

    const tituloBase = String(req.body.titulo || req.file.originalname || 'Documento PDF').trim();
    const categoria = String(req.body.categoria || 'general').trim();
    const fuente = String(req.body.fuente || 'pdf_superadmin').trim();

    console.log('IA | Procesando PDF por tenant:', {
      tenantId: tenant._id,
      originalName: req.file.originalname,
      chunks: chunks.length
    });

    for (let index = 0; index < chunks.length; index += 1) {
      await guardarDocumentoVectorial({
        titulo: `${tituloBase} - Chunk ${index + 1}`,
        contenido: chunks[index],
        categoria,
        fuente,
        tenantId: tenant.tenantId,
        metadata: {
          uploadedBy: req.user._id,
          uploadedByRole: req.user.rol,
          originalName: req.file.originalname,
          tipo: 'pdf',
          chunkIndex: index,
          totalChunks: chunks.length,
          size: req.file.size,
          mimetype: req.file.mimetype,
          tenantName: tenant.nombre,
          createdFrom: 'superadmin'
        }
      });
    }

    return res.status(201).json({
      ok: true,
      message: 'PDF procesado correctamente',
      archivo: req.file.originalname,
      tenantId: tenant.tenantId,
      chunksGuardados: chunks.length
    });
  } catch (error) {
    console.error('IA | Error procesando PDF por tenant:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get('/tenants/:tenantId/documentos', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);
    const documentos = await listarDocumentosPorTenant(tenant.tenantId);

    return res.json({
      ok: true,
      tenantId: tenant.tenantId,
      total: documentos.length,
      documentos: documentos.map((documento) => ({
        id: documento._id,
        titulo: documento.titulo,
        categoria: documento.categoria,
        fuente: documento.fuente,
        tenantId: documento.tenantId,
        metadata: documento.metadata || {},
        createdAt: documento.createdAt,
        updatedAt: documento.updatedAt
      }))
    });
  } catch (error) {
    console.error('IA | Error listando documentos por tenant:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.delete('/tenants/:tenantId/documentos/:documentoId', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);
    const documento = await eliminarDocumentoPorTenant(tenant.tenantId, req.params.documentoId);

    if (!documento) {
      return res.status(404).json({
        ok: false,
        error: 'Documento no encontrado para esta empresa'
      });
    }

    return res.json({
      ok: true,
      message: 'Documento eliminado correctamente',
      documento: {
        id: documento._id,
        titulo: documento.titulo,
        tenantId: documento.tenantId
      }
    });
  } catch (error) {
    console.error('IA | Error eliminando documento por tenant:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/tenants/:tenantId/preguntar', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);
    const { pregunta, limite, topK } = req.body;

    if (!pregunta || !String(pregunta).trim()) {
      return res.status(400).json({ ok: false, error: 'pregunta es requerida' });
    }

    const resultado = await responderConRAG(pregunta, {
      tenantId: tenant.tenantId,
      limite: limite || topK
    });

    return res.json({
      ok: true,
      tenantId: tenant.tenantId,
      tenantNombre: tenant.nombre,
      ...resultado,
      documentos: resultado.documentos.map((documento) => ({
        id: documento._id || documento.id,
        titulo: documento.titulo,
        contenido: documento.contenido,
        categoria: documento.categoria,
        fuente: documento.fuente,
        tenantId: documento.tenantId,
        score: documento.score
      }))
    });
  } catch (error) {
    console.error('IA | Error preguntando por tenant:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

module.exports = router;
