/**
 * Middleware ABAC
 * Proporciona funciones para verificar permisos basadas en atributos
 */

const { ABACContext, abacEngine } = require('../policies/abac.policy');
const Project = require('../models/project.model');
const Organization = require('../models/organization.model');
const Tarea = require('../models/tarea.model');
const auditLogService = require('../services/auditLog.service');

/**
 * Verifica un permiso usando ABAC
 * @param {String} recurso - Tipo de recurso ('task', 'project', 'organization')
 * @param {String} accion - Acción a verificar ('read', 'create', 'update', 'delete', 'mark_done')
 * @returns {Function} Middleware Express
 */
const checkABACPermission = (recurso, accion) => {
  return async (req, res, next) => {
    try {
      const usuario = req.usuario;
      let proyecto = null;
      let organizacion = null;
      let recursoObj = null;

      // Obtener el proyecto si es necesario
      if (req.params.projectId) {
        proyecto = await Project.findById(req.params.projectId);
        if (!proyecto) {
          return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
      }

      // Obtener la organización si es necesario
      if (req.params.organizationId) {
        organizacion = await Organization.findById(req.params.organizationId);
        if (!organizacion) {
          return res.status(404).json({ error: 'Organización no encontrada' });
        }
      }

      // Obtener el recurso específico si es necesario
      if (recurso === 'task' && req.params.taskId) {
        recursoObj = await Tarea.findById(req.params.taskId);
        if (!recursoObj) {
          return res.status(404).json({ error: 'Tarea no encontrada' });
        }
      }

      // Crear contexto ABAC
      const context = new ABACContext({
        usuario,
        recurso,
        accion,
        organizacion,
        proyecto,
        recursoObj
      });

      // Evaluar política
      const permitido = await abacEngine.evaluate(context);

      if (!permitido) {
        // Registrar intento no autorizado
        await auditLogService.logTaskEvent('access.denied', req, {
          recurso,
          accion,
          projectId: proyecto?._id,
          organizationId: organizacion?._id,
          resourceId: recursoObj?._id,
          reason: `Usuario no tiene permiso para ${accion} ${recurso}`
        });

        return res.status(403).json({
          error: `No tienes permiso para ${accion} este ${recurso}`
        });
      }

      // Guardar en req para uso posterior
      req.proyecto = proyecto;
      req.organizacion = organizacion;
      req.recursoObj = recursoObj;

      next();
    } catch (err) {
      console.error(`Error en checkABACPermission (${recurso}.${accion}):`, err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
};

/**
 * Verifica si un usuario es super_admin
 */
const checkSuperAdmin = async (req, res, next) => {
  try {
    if (req.usuario.rol !== 'super_admin') {
      await auditLogService.logTaskEvent('access.denied', req, {
        reason: 'Acceso solo para super_admin'
      });
      return res.status(403).json({ error: 'Solo super_admin puede acceder a este recurso' });
    }
    next();
  } catch (err) {
    console.error('Error en checkSuperAdmin:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Verifica si un proyecto está archivado
 */
const checkProjectNotArchived = async (req, res, next) => {
  try {
    if (req.proyecto && req.proyecto.estado === 'archivado') {
      return res.status(403).json({
        error: 'No se pueden realizar cambios en proyectos archivados'
      });
    }
    next();
  } catch (err) {
    console.error('Error en checkProjectNotArchived:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  checkABACPermission,
  checkSuperAdmin,
  checkProjectNotArchived
};
