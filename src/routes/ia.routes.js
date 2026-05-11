const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { responderConRAG } = require('../services/rag.service');
const Tenant = require('../models/Tenant');
const Admin = require('../models/Admin');
const Cobrador = require('../models/Cobrador');
const { verifyToken } = require('../utils/jwt');
const {
  buscarDocumentosSimilares,
  desactivarDocumentoGrupoPorTenant,
  eliminarDocumentoPorTenant,
  eliminarDocumentoGrupoPorTenant,
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

const isSuperAdminRole = (rol) => rol === 'superadmin' || rol === 'superadministrador';

const buildSafeUser = (userDoc, fallbackRol) => ({
  _id: userDoc._id,
  nombre: userDoc.nombre,
  email: userDoc.email,
  rol: userDoc.rol || fallbackRol,
  tenantId: userDoc.tenantId ? normalizeTenantId(userDoc.tenantId) : null
});

const requireIaAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token no proporcionado' });
    }

    const decoded = verifyToken(token);
    let user = await Admin.findById(decoded.id).select('-password');

    if (user) {
      req.user = buildSafeUser(user, user.rol);
      return next();
    }

    user = await Cobrador.findById(decoded.id).select('-password');

    if (user) {
      req.user = buildSafeUser(user, 'cobrador');
      return next();
    }

    return res.status(401).json({ ok: false, error: 'Usuario no encontrado' });
  } catch (error) {
    console.error('IA | Error autenticando usuario:', error.message);
    return res.status(401).json({ ok: false, error: 'Token invalido o expirado' });
  }
};

// Se puede extraer este middleware a un archivo compartido cuando se unifique con superadmin.routes.js.
const requireSuperAdmin = async (req, res, next) => {
  try {
    await requireIaAuth(req, res, async () => {
      const admin = await Admin.findById(req.user._id).select('-password');

      if (!admin) {
        return res.status(401).json({ ok: false, error: 'Usuario no encontrado' });
      }

      if (!isSuperAdminRole(admin.rol)) {
        return res.status(403).json({ ok: false, error: 'No autorizado para gestionar documentos IA' });
      }

      req.user = buildSafeUser(admin, admin.rol);
      next();
    });
  } catch (error) {
    console.error('IA | Error autenticando superadmin:', error.message);
    return res.status(401).json({ ok: false, error: 'Token invalido o expirado' });
  }
};

const normalizarTexto = (valor) => String(valor || '').replace(/\s+/g, ' ').trim();

const resolveTenantForAuthenticatedUser = (req, tenantIdCandidate) => {
  const requestedTenantId = normalizeTenantId(tenantIdCandidate);
  const userTenantId = normalizeTenantId(req.user?.tenantId);

  if (isSuperAdminRole(req.user?.rol)) {
    if (!requestedTenantId) {
      const error = new Error('tenantId es requerido para usuarios superadmin');
      error.statusCode = 400;
      throw error;
    }

    return requestedTenantId;
  }

  if (!userTenantId) {
    const error = new Error('El usuario autenticado no tiene tenantId asociado');
    error.statusCode = 403;
    throw error;
  }

  if (requestedTenantId && requestedTenantId !== userTenantId) {
    const error = new Error('No autorizado para operar sobre otro tenantId');
    error.statusCode = 403;
    throw error;
  }

  return userTenantId;
};

const mapDocumentoResponse = (documento) => ({
  id: documento._id,
  titulo: documento.titulo,
  categoria: documento.categoria,
  fuente: documento.fuente,
  tenantId: documento.tenantId,
  documentGroupId: documento.documentGroupId || null,
  sourceType: documento.sourceType || documento.metadata?.tipo || 'text',
  fileName: documento.fileName || documento.metadata?.originalName || '',
  version: documento.version || 1,
  activo: documento.activo !== false,
  metadata: documento.metadata || {},
  createdAt: documento.createdAt,
  updatedAt: documento.updatedAt
});

const buildDocumentGroups = (documentos) => {
  const groups = new Map();

  documentos.forEach((documento) => {
    const groupId = documento.documentGroupId || String(documento._id);

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        documentGroupId: groupId,
        tenantId: documento.tenantId,
        titulo: documento.fileName || documento.metadata?.originalName || documento.titulo,
        categoria: documento.categoria,
        fuente: documento.fuente,
        sourceType: documento.sourceType || documento.metadata?.tipo || 'text',
        fileName: documento.fileName || documento.metadata?.originalName || '',
        version: documento.version || 1,
        activo: documento.activo !== false,
        totalChunks: 0,
        createdAt: documento.createdAt,
        updatedAt: documento.updatedAt
      });
    }

    const current = groups.get(groupId);
    current.totalChunks += 1;

    if (new Date(documento.updatedAt) > new Date(current.updatedAt)) {
      current.updatedAt = documento.updatedAt;
    }
  });

  return Array.from(groups.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

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

router.post('/documentos-vectoriales', requireIaAuth, async (req, res) => {
  try {
    const { titulo, contenido, categoria, fuente, tenantId, metadata } = req.body;
    const resolvedTenantId = resolveTenantForAuthenticatedUser(req, tenantId);

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
      tenantId: resolvedTenantId,
      documentGroupId: String(req.body.documentGroupId || new mongoose.Types.ObjectId()),
      sourceType: String(req.body.sourceType || 'text').trim(),
      fileName: String(req.body.fileName || '').trim(),
      version: req.body.version,
      activo: req.body.activo !== false,
      uploadedBy: req.user._id,
      uploadedByRole: req.user.rol,
      metadata,
      userRole: req.user.rol
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
        documentGroupId: documento.documentGroupId,
        sourceType: documento.sourceType,
        fileName: documento.fileName,
        version: documento.version,
        activo: documento.activo,
        metadata: documento.metadata,
        dimensiones: Array.isArray(documento.embedding) ? documento.embedding.length : 0,
        createdAt: documento.createdAt
      }
    });
  } catch (error) {
    console.error('IA | Error guardando documento vectorial:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/buscar-vector', requireIaAuth, async (req, res) => {
  try {
    const { pregunta, topK, tenantId } = req.body;
    const resolvedTenantId = resolveTenantForAuthenticatedUser(req, tenantId);

    if (!pregunta || !String(pregunta).trim()) {
      return res.status(400).json({ ok: false, error: 'pregunta es requerida' });
    }

    console.log('IA | Busqueda vectorial:', { pregunta, topK });

    const documentos = await buscarDocumentosSimilares(pregunta, {
      topK,
      tenantId: resolvedTenantId,
      userRole: req.user.rol
    });

    return res.json({
      ok: true,
      pregunta: String(pregunta).trim(),
      total: documentos.length,
      documentos
    });
  } catch (error) {
    console.error('IA | Error en busqueda vectorial:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post('/preguntar', requireIaAuth, async (req, res) => {
  try {
    const { pregunta, topK, tenantId } = req.body;
    const resolvedTenantId = resolveTenantForAuthenticatedUser(req, tenantId);

    if (!pregunta || !String(pregunta).trim()) {
      return res.status(400).json({ ok: false, error: 'pregunta es requerida' });
    }

    console.log('IA | Pregunta RAG:', { pregunta, topK });

    const resultado = await responderConRAG(pregunta, {
      topK,
      tenantId: resolvedTenantId,
      userRole: req.user.rol
    });

    return res.json({
      ok: true,
      ...resultado
    });
  } catch (error) {
    console.error('IA | Error en RAG:', error.message);
    return res.status(error.statusCode || 500).json({
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
      documentGroupId: String(req.body.documentGroupId || new mongoose.Types.ObjectId()),
      sourceType: 'text',
      fileName: String(req.body.fileName || '').trim(),
      version: req.body.version,
      activo: req.body.activo !== false,
      uploadedBy: req.user._id,
      uploadedByRole: req.user.rol,
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
        documentGroupId: documento.documentGroupId,
        sourceType: documento.sourceType,
        fileName: documento.fileName,
        version: documento.version,
        activo: documento.activo,
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
      return res.status(400).json({ ok: false, error: 'El PDF no contiene texto extraible. Si es un PDF escaneado, necesitas OCR antes de subirlo.' });
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
    const documentGroupId = String(req.body.documentGroupId || new mongoose.Types.ObjectId());
    const fileName = String(req.body.fileName || req.file.originalname || '').trim();

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
        documentGroupId,
        sourceType: 'pdf',
        fileName,
        version: req.body.version,
        activo: true,
        uploadedBy: req.user._id,
        uploadedByRole: req.user.rol,
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
      documentGroupId,
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
    const grupos = buildDocumentGroups(documentos);

    return res.json({
      ok: true,
      tenantId: tenant.tenantId,
      total: documentos.length,
      grupos: grupos.length,
      documentos: documentos.map(mapDocumentoResponse),
      resumenGrupos: grupos
    });
  } catch (error) {
    console.error('IA | Error listando documentos por tenant:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get('/tenants/:tenantId/documentos/estado', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);
    const documentos = await listarDocumentosPorTenant(tenant.tenantId);
    const resumenGrupos = buildDocumentGroups(documentos);
    const activos = documentos.filter((documento) => documento.activo !== false).length;

    return res.json({
      ok: true,
      tenantId: tenant.tenantId,
      totalDocumentos: documentos.length,
      totalActivos: activos,
      totalGrupos: resumenGrupos.length,
      gruposActivos: resumenGrupos.filter((grupo) => grupo.activo !== false).length,
      resumenGrupos
    });
  } catch (error) {
    console.error('IA | Error consultando estado de documentos por tenant:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.patch('/tenants/:tenantId/documentos/grupo/:documentGroupId/desactivar', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);
    const resultado = await desactivarDocumentoGrupoPorTenant(tenant.tenantId, req.params.documentGroupId);

    return res.json({
      ok: true,
      tenantId: tenant.tenantId,
      documentGroupId: req.params.documentGroupId,
      actualizados: resultado.modifiedCount || 0
    });
  } catch (error) {
    console.error('IA | Error desactivando grupo documental:', error.message);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.delete('/tenants/:tenantId/documentos/grupo/:documentGroupId', requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await getTenantByTenantId(req.params.tenantId);
    const resultado = await eliminarDocumentoGrupoPorTenant(tenant.tenantId, req.params.documentGroupId);

    return res.json({
      ok: true,
      tenantId: tenant.tenantId,
      documentGroupId: req.params.documentGroupId,
      eliminados: resultado.deletedCount || 0
    });
  } catch (error) {
    console.error('IA | Error eliminando grupo documental:', error.message);
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
      limite: limite || topK,
      userRole: req.user.rol
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
