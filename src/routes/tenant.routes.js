const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenant.controller');
const tenantMiddleware = require('../middleware/tenant.middleware');

// Todas estas rutas requieren Token de Super Admin (manejado por tu middleware)
router.get('/', tenantMiddleware, tenantController.obtenerOficinas);
router.post('/', tenantMiddleware, tenantController.crearOficina);

module.exports = router;