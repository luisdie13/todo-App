const express = require('express');
const router = express.Router();
const { authentication } = require('../middleware/authentication');
const auditController = require('../controllers/audit.controller');

// Aplicar autenticación a todas las rutas
router.use(authentication);

// GET /api/admin/audit-logs - Obtener todos los logs de auditoría
router.get('/audit-logs', auditController.getAllLogs);

// GET /api/admin/audit-logs/event/:evento - Logs por evento
router.get('/audit-logs/event/:evento', auditController.getLogsByEvent);

// GET /api/admin/audit-logs/user/:userId - Logs por usuario
router.get('/audit-logs/user/:userId', auditController.getLogsByUser);

// GET /api/admin/audit-logs/ip/:ip - Logs por IP
router.get('/audit-logs/ip/:ip', auditController.getLogsByIP);

// GET /api/admin/audit-logs/email/:email - Logs por email
router.get('/audit-logs/email/:email', auditController.getLogsByEmail);

// GET /api/admin/audit-stats - Estadísticas de auditoría
router.get('/audit-stats', auditController.getAuditStats);

module.exports = router;
