const auditLogService = require('../services/auditLog.service');

/**
 * Middleware para registrar eventos de auditoría en operaciones de tareas
 * Captura: actorId (userId), IP, userAgent
 */

/**
 * Middleware para registrar creación de tareas
 * Uso: router.post('/', auditTaskCreate, controller)
 */
const auditTaskCreate = async (req, res, next) => {
  const originalSend = res.send;

  res.send = async function (data) {
    try {
       // Solo registrar si fue exitoso (status 201)
       if (res.statusCode === 201 && req.user) {
         await auditLogService.logTaskEvent('task.created', req, {
          taskId: res.locals?.taskId,
          projectId: req.body?.projectId,
          taskTitle: req.body?.title
        });
      }
    } catch (err) {
      console.error('Error en auditTaskCreate:', err);
      // No interrumpir el flujo
    }

    // Continuar con el envío normal
    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware para registrar actualización de tareas
 * Uso: router.put('/:id', auditTaskUpdate, controller)
 */
const auditTaskUpdate = async (req, res, next) => {
  const originalSend = res.send;

  res.send = async function (data) {
    try {
      // Registrar si fue exitoso (status 200)
      if (res.statusCode === 200 && req.user) {
        await auditLogService.logTaskEvent('task.updated', req, {
          taskId: req.params.id,
          taskTitle: req.body?.title
        });
      }
    } catch (err) {
      console.error('Error en auditTaskUpdate:', err);
      // No interrumpir el flujo
    }

    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware para registrar eliminación de tareas
 * Uso: router.delete('/:id', auditTaskDelete, controller)
 */
const auditTaskDelete = async (req, res, next) => {
  const originalSend = res.send;

  res.send = async function (data) {
    try {
      // Registrar si fue exitoso (status 204 o 200)
      if ((res.statusCode === 204 || res.statusCode === 200) && req.user) {
        await auditLogService.logTaskEvent('task.deleted', req, {
          taskId: req.params.id
        });
      }
    } catch (err) {
      console.error('Error en auditTaskDelete:', err);
      // No interrumpir el flujo
    }

    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware para registrar intentos de acceso no autorizado a tareas
 */
const auditUnauthorizedTaskAccess = async (req, res, next) => {
  const originalSend = res.send;

  res.send = async function (data) {
    try {
      // Registrar si fue denegado (status 403)
      if (res.statusCode === 403 && req.user) {
        await auditLogService.logTaskEvent('task.unauthorized_access', req, {
          taskId: req.params.id,
          action: req.method,
          reason: 'No tienes permiso para acceder a esta tarea'
        });
      }
    } catch (err) {
      console.error('Error en auditUnauthorizedTaskAccess:', err);
      // No interrumpir el flujo
    }

    originalSend.call(this, data);
  };

  next();
};

module.exports = {
  auditTaskCreate,
  auditTaskUpdate,
  auditTaskDelete,
  auditUnauthorizedTaskAccess
};
