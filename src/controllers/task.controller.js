const Tarea = require('../models/tarea.model');
const Organization = require('../models/organization.model');
const Membership = require('../models/membership.model');
const { canCreateTask } = require('../middleware/checkPermission');
const auditLogService = require('../services/auditLog.service');

/**
 * GET /api/projects/:projectId/tasks
 * Obtiene todas las tareas de un proyecto
 */
const getProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.usuario.id;

    // Verificar que el proyecto existe
    const project = await Organization.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar que el usuario es miembro del proyecto
    const membership = await Membership.findOne({
      userId,
      projectId
    });

    if (!membership) {
      return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
    }

    // Obtener todas las tareas del proyecto
    const tareas = await Tarea.find({ projectId })
      .populate('usuarioId', 'email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      proyecto: projectId,
      tareas,
      total: tareas.length
    });

  } catch (err) {
    console.error('Error al obtener tareas del proyecto:', err);
    next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks
 * Crea una nueva tarea en un proyecto
 */
const createProjectTask = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { title, description, sensitive = false } = req.body;
    const userId = req.user.id;

    // Validar entrada
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'El título es requerido' });
    }

    // Verificar que el proyecto existe
    const Project = require('../models/project.model');
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar que el usuario tiene acceso al proyecto
    const Organization = require('../models/organization.model');
    const organization = await Organization.findById(project.organizationId);
    const isProjectCreator = project.creador.toString() === userId;
    const isOrgCreator = organization.creador.toString() === userId;
    const isOrgMember = organization.miembros.some(m => m.usuario.toString() === userId);
    
    if (!isProjectCreator && !isOrgCreator && !isOrgMember) {
      await auditLogService.logTaskEvent('task.unauthorized_access', req, {
        projectId,
        action: 'CREATE',
        reason: 'Usuario no tiene acceso al proyecto'
      });
      return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
    }

    // Crear tarea
    const tarea = new Tarea({
      title: title.trim(),
      description: description ? description.trim() : null,
      sensitive: sensitive === true,
      usuarioId: userId,
      projectId
    });

    await tarea.save();
    await tarea.populate('usuarioId', 'email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('task.created', req, {
      taskId: tarea._id,
      projectId,
      taskTitle: tarea.title,
      sensitive: tarea.sensitive
    });

    return res.status(201).json({
      mensaje: 'Tarea creada exitosamente',
      tarea
    });

  } catch (err) {
    console.error('Error al crear tarea:', err);
    next(err);
  }
};

/**
 * GET /api/projects/:projectId/tasks/:taskId
 * Obtiene los detalles de una tarea específica
 */
const getProjectTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.usuario.id;

    // Verificar membresía
    const membership = await Membership.findOne({
      userId,
      projectId
    });

    if (!membership) {
      return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
    }

    // Obtener tarea
    const tarea = await Tarea.findOne({
      _id: taskId,
      projectId
    }).populate('usuarioId', 'email');

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    return res.status(200).json(tarea);

  } catch (err) {
    console.error('Error al obtener tarea:', err);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId
 * Actualiza una tarea del proyecto
 */
const updateProjectTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const { title, description, completed } = req.body;
    const userId = req.usuario.id;

    // Obtener tarea
    const tarea = await Tarea.findOne({
      _id: taskId,
      projectId
    });

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Verificar permisos (usar checkPermission)
    const { canEditTask } = require('../middleware/checkPermission');
    const canEdit = await canEditTask(req.usuario, tarea);

    if (!canEdit) {
      // Registrar intento no autorizado
      await auditLogService.logTaskEvent('task.unauthorized_access', req, {
        taskId,
        projectId,
        action: 'UPDATE',
        reason: 'Usuario no tiene permiso para editar esta tarea'
      });
      return res.status(403).json({ error: 'No tienes permiso para editar esta tarea' });
    }

    // Actualizar campos
    if (title) {
      tarea.title = title.trim();
    }

    if (description !== undefined) {
      tarea.description = description ? description.trim() : null;
    }

    if (completed !== undefined) {
      tarea.completed = completed;
    }

    await tarea.save();
    await tarea.populate('usuarioId', 'email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('task.updated', req, {
      taskId,
      projectId,
      taskTitle: tarea.title
    });

    return res.status(200).json({
      mensaje: 'Tarea actualizada exitosamente',
      tarea
    });

  } catch (err) {
    console.error('Error al actualizar tarea:', err);
    next(err);
  }
};

/**
 * DELETE /api/projects/:projectId/tasks/:taskId
 * Elimina una tarea del proyecto
 */
const deleteProjectTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.usuario.id;

    // Obtener tarea
    const tarea = await Tarea.findOne({
      _id: taskId,
      projectId
    });

    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Verificar permisos
    const { canEditTask } = require('../middleware/checkPermission');
    const canDelete = await canEditTask(req.usuario, tarea);

    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta tarea' });
    }

    // Eliminar
    await Tarea.findByIdAndDelete(taskId);

    // Registrar en auditoría
    await auditLogService.logTaskEvent('task.deleted', req, {
      taskId,
      projectId,
      taskTitle: tarea.title
    });

    return res.status(200).json({
      mensaje: 'Tarea eliminada exitosamente'
    });

  } catch (err) {
    console.error('Error al eliminar tarea:', err);
    next(err);
  }
};

module.exports = {
  getProjectTasks,
  createProjectTask,
  getProjectTask,
  updateProjectTask,
  deleteProjectTask
};
