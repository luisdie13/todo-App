const Membership = require('../models/membership.model');
const Tarea = require('../models/tarea.model');
const Organization = require('../models/organization.model');

/**
 * Verifica si un usuario puede leer una tarea basado en su rol en el proyecto
 * Retorna true si:
 * - El usuario es project_admin del proyecto
 * - El usuario es developer o viewer del proyecto
 * @param {Object} user - Usuario autenticado (req.usuario)
 * @param {Object} task - Tarea a verificar
 * @returns {Promise<Boolean>}
 */
const canReadTask = async (user, task) => {
  try {
    // Si el usuario es el propietario de la tarea, puede leerla
    if (task.usuarioId.toString() === user.id) {
      return true;
    }

    // Si la tarea tiene un projectId, verificar membresía
    if (task.projectId) {
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: task.projectId
      });

      if (membership && membership.canRead()) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error en canReadTask:', err);
    return false;
  }
};

/**
 * Verifica si un usuario puede editar una tarea basado en su rol en el proyecto
 * Retorna true si:
 * - El usuario es project_admin del proyecto
 * - El usuario es developer Y es el propietario de la tarea
 * @param {Object} user - Usuario autenticado (req.usuario)
 * @param {Object} task - Tarea a verificar
 * @returns {Promise<Boolean>}
 */
const canEditTask = async (user, task) => {
  try {
    // Si la tarea no tiene projectId, usar la lógica original (propietario)
    if (!task.projectId) {
      return task.usuarioId.toString() === user.id;
    }

    // Verificar membresía en el proyecto
    const membership = await Membership.findOne({
      userId: user.id,
      projectId: task.projectId
    });

    if (!membership) {
      return false;
    }

    // project_admin puede editar cualquier tarea
    if (membership.isAdmin()) {
      return true;
    }

    // developer puede editar solo sus propias tareas
    if (membership.hasRole('developer')) {
      return task.usuarioId.toString() === user.id;
    }

    // viewer no puede editar
    return false;
  } catch (err) {
    console.error('Error en canEditTask:', err);
    return false;
  }
};

/**
 * Verifica si un usuario puede crear una tarea en un proyecto
 * Retorna true si:
 * - El usuario es project_admin del proyecto
 * - El usuario es developer del proyecto
 * @param {Object} user - Usuario autenticado (req.usuario)
 * @param {String} projectId - ID del proyecto
 * @returns {Promise<Boolean>}
 */
const canCreateTask = async (user, projectId) => {
  try {
    if (!projectId) {
      // Si no hay projectId, cualquier usuario autenticado puede crear tareas
      return true;
    }

    const membership = await Membership.findOne({
      userId: user.id,
      projectId: projectId
    });

    if (!membership) {
      return false;
    }

    // Solo project_admin y developer pueden crear tareas
    return membership.canWrite();
  } catch (err) {
    console.error('Error en canCreateTask:', err);
    return false;
  }
};

/**
 * Middleware que verifica permisos de lectura de tarea
 * Uso: router.get('/:id', checkReadPermission, handler)
 */
const checkReadPermission = async (req, res, next) => {
  try {
    const tarea = await Tarea.findById(req.params.id);

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    const hasPermission = await canReadTask(req.usuario, tarea);

    if (!hasPermission) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a esta tarea' });
    }

    // Guardar la tarea en req para uso posterior
    req.tarea = tarea;
    next();
  } catch (err) {
    console.error('Error en checkReadPermission:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Middleware que verifica permisos de edición de tarea
 * Uso: router.put('/:id', checkEditPermission, handler)
 */
const checkEditPermission = async (req, res, next) => {
  try {
    const tarea = await Tarea.findById(req.params.id);

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    const hasPermission = await canEditTask(req.usuario, tarea);

    if (!hasPermission) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar esta tarea' });
    }

    // Guardar la tarea en req para uso posterior
    req.tarea = tarea;
    next();
  } catch (err) {
    console.error('Error en checkEditPermission:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Middleware que verifica permisos de creación de tarea
 * Uso: router.post('/', checkCreatePermission, handler)
 */
const checkCreatePermission = async (req, res, next) => {
  try {
    const projectId = req.body.projectId;
    const hasPermission = await canCreateTask(req.usuario, projectId);

    if (!hasPermission) {
      return res.status(403).json({ error: 'No tienes permiso para crear tareas en este proyecto' });
    }

    next();
  } catch (err) {
    console.error('Error en checkCreatePermission:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  canReadTask,
  canEditTask,
  canCreateTask,
  checkReadPermission,
  checkEditPermission,
  checkCreatePermission
};
