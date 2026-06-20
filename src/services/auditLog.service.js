const AuditLog = require('../models/auditLog.model');

/**
 * Servicio centralizado para registrar eventos de auditoría
 * Proporciona la función log() con try/catch interno para evitar interrupciones
 */

/**
 * Registra un evento de auditoría de forma segura
 * 
 * @param {string} evento - Tipo de evento (auth.register, auth.login.success, etc.)
 * @param {Object} req - Objeto request de Express
 * @param {Object} options - Opciones adicionales
 * @param {string} options.email - Email del usuario (opcional)
 * @param {string} options.userId - ID del usuario (opcional)
 * @param {string} options.detalles - Detalles adicionales (opcional)
 * @param {number} options.statusCode - Código HTTP de la respuesta (opcional)
 * 
 * @returns {Promise<Object|null>} - El documento creado o null si hay error
 */
const log = async (evento, req, options = {}) => {
  try {
    // Validar que el evento sea válido
    const eventosValidos = [
      'auth.register',
      'auth.login.success',
      'auth.login.failure',
      'auth.logout',
      'security.unauthorized',
      'security.rate_limited',
      'task.created',
      'task.updated',
      'task.deleted',
      'task.marked_done',
      'task.unauthorized_access',
      'project.created',
      'project.updated',
      'project.deleted',
      'project.archived',
      'project.unarchived',
      'access.denied',
      'audit.logs_viewed',
      'audit.stats_viewed'
    ];

    if (!eventosValidos.includes(evento)) {
      console.warn(`Evento de auditoría inválido: ${evento}`);
      return null;
    }

    // Extraer información del request
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    
    // Opciones adicionales
    const {
      email = null,
      userId = null,
      detalles = null,
      statusCode = null
    } = options;

    // Registrar el evento en base de datos
    const auditLog = await AuditLog.registrarEvento(
      evento,
      ip,
      userAgent,
      email,
      detalles,
      statusCode,
      userId
    );

    // Log en consola para debugging
    console.log(`[AUDIT] ${evento} | IP: ${ip} | Email: ${email} | Timestamp: ${new Date().toISOString()}`);

    return auditLog;
  } catch (err) {
    // Capturar errores internos sin interrumpir el flujo principal
    console.error('Error al registrar auditoría:', err.message);
    return null;
  }
};

/**
 * Obtiene los últimos logs de auditoría
 * @param {number} limit - Número de registros a obtener (default: 10)
 * @returns {Promise<Array>} - Array de logs de auditoría
 */
const obtenerUltimos = async (limit = 10) => {
  try {
    return await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('Error al obtener logs de auditoría:', err.message);
    return [];
  }
};

/**
 * Obtiene logs por evento específico
 * @param {string} evento - Tipo de evento a filtrar
 * @param {number} limit - Número de registros a obtener
 * @returns {Promise<Array>} - Array de logs filtrados
 */
const obtenerPorEvento = async (evento, limit = 10) => {
  try {
    return await AuditLog.find({ evento })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error(`Error al obtener logs del evento ${evento}:`, err.message);
    return [];
  }
};

/**
 * Obtiene logs por IP
 * @param {string} ip - Dirección IP a filtrar
 * @param {number} limit - Número de registros a obtener
 * @returns {Promise<Array>} - Array de logs filtrados
 */
const obtenerPorIP = async (ip, limit = 10) => {
  try {
    return await AuditLog.find({ ip })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error(`Error al obtener logs de IP ${ip}:`, err.message);
    return [];
  }
};

/**
 * Obtiene logs por email
 * @param {string} email - Email a filtrar
 * @param {number} limit - Número de registros a obtener
 * @returns {Promise<Array>} - Array de logs filtrados
 */
const obtenerPorEmail = async (email, limit = 10) => {
  try {
    return await AuditLog.find({ email: email.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error(`Error al obtener logs del email ${email}:`, err.message);
    return [];
  }
};

/**
 * Registra eventos específicos de tareas
 * Similar a log() pero con campos específicos para tareas
 * 
 * @param {string} evento - Tipo de evento (task.created, task.updated, etc.)
 * @param {Object} req - Objeto request de Express
 * @param {Object} options - Opciones adicionales con datos de la tarea
 * @returns {Promise<Object|null>} - El documento creado o null si hay error
 */
const logTaskEvent = async (evento, req, options = {}) => {
  try {
     const ip = req.ip || req.connection.remoteAddress || 'unknown';
     const userAgent = req.get('user-agent') || 'unknown';
     const userId = req.user?.id || null;
    
    // Construir detalles con información de la tarea
    const { taskId, projectId, taskTitle, action, reason } = options;
    
    let detalles = `Evento: ${evento}`;
    if (taskId) detalles += ` | Task ID: ${taskId}`;
    if (projectId) detalles += ` | Project ID: ${projectId}`;
    if (taskTitle) detalles += ` | Title: ${taskTitle}`;
    if (action) detalles += ` | Action: ${action}`;
    if (reason) detalles += ` | Reason: ${reason}`;

    // Registrar el evento en base de datos
    const auditLog = await AuditLog.registrarEvento(
      evento,
      ip,
      userAgent,
      null, // email (no siempre disponible en operaciones de tarea)
      detalles,
      null, // statusCode (se puede pasar en options si es necesario)
      userId
    );

    console.log(`[AUDIT TASK] ${evento} | User: ${userId} | IP: ${ip} | ${detalles}`);

    return auditLog;
  } catch (err) {
    console.error('Error al registrar evento de tarea:', err.message);
    return null;
  }
};

module.exports = {
  log,
  logTaskEvent,
  obtenerUltimos,
  obtenerPorEvento,
  obtenerPorIP,
  obtenerPorEmail
};
