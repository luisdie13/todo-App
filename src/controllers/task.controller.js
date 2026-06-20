const Task = require('../models/task.model');
const Organization = require('../models/organization.model');
const Membership = require('../models/membership.model');
const { canCreateTask } = require('../middleware/checkPermission');
const auditLogService = require('../services/auditLog.service');

/**
 * GET /api/projects/:projectId/tasks
 * Obtiene todas las tareas de un proyecto (Validando acceso vía Organización)
 */
const getProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // 1. Buscar proyecto
    const Project = require('../models/project.model');
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 2. Buscar organización dueña del proyecto
    const Organization = require('../models/organization.model');
    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Project organization does not exist' });
    }

     // 3. Validar accesos usando la estructura comprobada de project.controller
      // PROTECCIÓN DEFENSIVA: Asegurar que ownerId existe antes de llamar .toString()
      const projectOwnerId = project.ownerId;
      const orgOwnerId = organization.ownerId;
      
      if (!projectOwnerId || !orgOwnerId) {
        console.error('CRITICAL ERROR: project.ownerId or organization.ownerId is undefined', {
          projectOwnerId: projectOwnerId ? 'exists' : 'UNDEFINED',
          orgOwnerId: orgOwnerId ? 'exists' : 'UNDEFINED'
        });
        return res.status(500).json({ error: 'Owner data corrupted on server' });
      }

      const isProjectCreator = projectOwnerId.toString?.() === userId || projectOwnerId === userId;
      const isOrgCreator = orgOwnerId.toString?.() === userId || orgOwnerId === userId;
      
      const isOrgMember = organization.members?.some(m => {
        if (!m.userId) return false;
        const idMember = m.userId?._id ? m.userId._id.toString?.() : m.userId.toString?.();
        return idMember === userId;
      }) || false;

    // Log de control en inglés para mantener el estándar en tu consola
    console.log(`🚀 [HIT] getProjectTasks -> User ID: ${userId} | Is Member: ${isOrgMember}`);

    if (!isProjectCreator && !isOrgCreator && !isOrgMember) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

      // 4. Retornar las tareas con populate defensivo
      const tasks = await Task.find({ projectId })
        .populate('userId', 'email')
        .populate('assignee', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      // DEFENSA: Transformar respuesta para asegurar estructura consistente
      const safeTasks = tasks.map(task => {
        return {
          _id: task._id,
          title: task.title,
          description: task.description,
          sensitive: task.sensitive,
          completed: task.completed,
          userId: task.userId,
          assignee: task.assignee,
          assigneeId: task.assignee, // Para compatibilidad frontend
          projectId: task.projectId,
          status: task.status || 'backlog',
          priority: task.priority || 'medium',
          dueDate: task.dueDate || null,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        };
      });

     return res.status(200).json(safeTasks);

  } catch (err) {
    console.error('Error getting project tasks:', err);
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
    const { title, description, sensitive = false, assigneeId = null, dueDate = null } = req.body;
    const userId = req.user.id;

    // Validar entrada
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verificar que el proyecto existe
    const Project = require('../models/project.model');
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verificar que el usuario tiene acceso al proyecto
    const Organization = require('../models/organization.model');
    const organization = await Organization.findById(project.organizationId);
    
    // PROTECCIÓN DEFENSIVA: Validar que ownerId existe antes de .toString()
    const projOwner = project.ownerId;
    const orgOwner = organization.ownerId;
    
    if (!projOwner || !orgOwner) {
      console.error('ERROR: Missing owner IDs in createProjectTask', { projOwner, orgOwner });
      return res.status(500).json({ error: 'Owner data corrupted' });
    }
    
    const isProjectCreator = projOwner.toString?.() === userId || projOwner === userId;
    const isOrgCreator = orgOwner.toString?.() === userId || orgOwner === userId;
    const isOrgMember = organization.members?.some(m => {
      if (!m.userId) return false;
      const memberUserId = m.userId._id ? m.userId._id.toString?.() : m.userId.toString?.();
      return memberUserId === userId;
    }) || false;
    
    if (!isProjectCreator && !isOrgCreator && !isOrgMember) {
      await auditLogService.logTaskEvent('task.unauthorized_access', req, {
        projectId,
        action: 'CREATE',
        reason: 'User does not have access to project'
      });
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Crear tarea
    const task = new Task({
      title: title.trim(),
      description: description ? description.trim() : null,
      sensitive: sensitive === true,
      userId: userId,
      assignee: assigneeId || null,
      projectId,
      dueDate: dueDate || null
    });

    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('task.created', req, {
      taskId: task._id,
      projectId,
      taskTitle: task.title,
      sensitive: task.sensitive,
      assigneeId: assigneeId
    });

    // Transformar respuesta para asegurar estructura consistente con Frontend
    const responseTask = {
      _id: task._id,
      title: task.title,
      description: task.description,
      sensitive: task.sensitive,
      completed: task.completed,
      userId: task.userId,
      assignee: task.assignee,
      assigneeId: task.assignee, // Para compatibilidad frontend
      projectId: task.projectId,
      status: task.status || 'backlog',
      priority: task.priority || 'medium',
      dueDate: task.dueDate || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };

    return res.status(201).json({
      message: 'Task created successfully',
      task: responseTask
    });

  } catch (err) {
    console.error('Error creating task:', err);
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
    const userId = req.user.id;

    // Verificar membresía
    const membership = await Membership.findOne({
      userId,
      projectId
    });

    if (!membership) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Obtener tarea
    const task = await Task.findOne({
      _id: taskId,
      projectId
    }).populate('userId', 'email').populate('assignee', 'name email');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json(task);

  } catch (err) {
    console.error('Error getting task:', err);
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
    const { title, description, completed, status, priority, assigneeId, dueDate } = req.body;
    const userId = req.user.id;

    // Obtener tarea
    const task = await Task.findOne({
      _id: taskId,
      projectId
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verificar permisos (usar checkPermission)
    const { canEditTask } = require('../middleware/checkPermission');
    const canEdit = await canEditTask(req.user, task);

    if (!canEdit) {
      // Registrar intento no autorizado
      await auditLogService.logTaskEvent('task.unauthorized_access', req, {
        taskId,
        projectId,
        action: 'UPDATE',
        reason: 'User does not have permission to edit this task'
      });
      return res.status(403).json({ error: 'You do not have permission to edit this task' });
    }

    // Actualizar campos
    if (title) {
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description ? description.trim() : null;
    }

    if (completed !== undefined) {
      task.completed = completed;
    }

    if (status) {
      task.status = status;
    }

    if (priority) {
      task.priority = priority;
    }

    if (assigneeId !== undefined) {
      task.assignee = assigneeId || null;
    }

    if (dueDate !== undefined) {
      task.dueDate = dueDate || null;
    }

    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('task.updated', req, {
      taskId,
      projectId,
      taskTitle: task.title
    });

    return res.status(200).json({
      message: 'Task updated successfully',
      task
    });

  } catch (err) {
    console.error('Error updating task:', err);
    next(err);
  }
};

/**
 * DELETE /api/projects/:projectId/tasks/:taskId
 * Elimina una tarea del proyecto
 * NOTA: project_admin puede eliminar CUALQUIER tarea, developer solo la suya
 */
const deleteProjectTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;

    // Obtener tarea
    const task = await Task.findOne({
      _id: taskId,
      projectId
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Obtener proyecto para validar membership
    const Project = require('../models/project.model');
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verificar membresía y permisos
    const membership = await Membership.findOne({
      userId,
      projectId
    });

    // Super admin siempre puede eliminar
    if (req.user.role === 'super_admin') {
      // Continuar con la eliminación
    }
    // project_admin puede eliminar cualquier tarea en su proyecto
    else if (membership && membership.isAdmin()) {
      // Continuar con la eliminación
    }
    // developer solo puede eliminar su propia tarea
    else if (membership && membership.hasRole('developer')) {
      if (task.userId.toString() !== userId) {
        await auditLogService.logTaskEvent('task.unauthorized_deletion', req, {
          taskId,
          projectId,
          reason: 'Developer can only delete their own tasks'
        });
        return res.status(403).json({ error: 'You can only delete your own tasks' });
      }
    }
    // Sin membresía, no puede eliminar
    else {
      await auditLogService.logTaskEvent('task.unauthorized_deletion', req, {
        taskId,
        projectId,
        reason: 'User does not have access to this project'
      });
      return res.status(403).json({ error: 'You do not have permission to delete this task' });
    }

    // Eliminar
    await Task.findByIdAndDelete(taskId);

    // Registrar en auditoría
    await auditLogService.logTaskEvent('task.deleted', req, {
      taskId,
      projectId,
      taskTitle: task.title
    });

    return res.status(200).json({
      message: 'Task deleted successfully'
    });

  } catch (err) {
    console.error('Error deleting task:', err);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/mark-done
 * Marca una tarea como completada (respeta ABAC)
 */
const markTaskDone = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;
    const { ABACContext, abacEngine } = require('../policies/abac.policy');
    const Project = require('../models/project.model');

    // Obtener tarea
    const task = await Task.findOne({
      _id: taskId,
      projectId
    }).populate('userId assignee', 'name email');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Obtener proyecto
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Crear contexto ABAC
    const context = new ABACContext({
      user: req.user,
      resource: 'task',
      action: 'mark_done',
      project,
      resourceId: taskId,
      resourceObj: task
    });

    // Evaluar política
    const allowed = await abacEngine.evaluate(context);

    if (!allowed) {
      await auditLogService.logTaskEvent('access.denied', req, {
        resource: 'task',
        action: 'mark_done',
        projectId,
        taskId,
        reason: 'User does not have permission to mark this task as completed'
      });
      return res.status(403).json({
        error: 'You do not have permission to mark this task as completed'
      });
    }

    // Marcar como done
    task.completed = true;
    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('task.marked_done', req, {
      taskId,
      projectId,
      taskTitle: task.title
    });

    return res.status(200).json({
      message: 'Task marked as completed',
      task
    });

  } catch (err) {
    console.error('Error marking task as completed:', err);
    next(err);
  }
};

/**
 * GET /api/tasks - Obtener tareas del usuario
 * Método plano para obtener tareas sin especificar proyecto
 */
const getTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Obtener todas las tareas del usuario actual
    const tasks = await Task.find({ userId: userId })
      .populate('userId', 'email')
      .populate('assignee', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    return res.status(200).json(tasks);
  } catch (err) {
    console.error('Error getting tasks:', err);
    next(err);
  }
};

/**
 * PUT /api/tasks/:id - Actualizar tarea (ruta plana)
 */
const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, completed, status, priority, assigneeId, dueDate } = req.body;
    const userId = req.user.id;

    // Obtener tarea
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verificar permisos (el usuario es propietario o asignado)
    if (task.userId.toString() !== userId && task.assignee?.toString() !== userId) {
      return res.status(403).json({ error: 'You do not have permission to edit this task' });
    }

    // Actualizar campos
    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description ? description.trim() : null;
    if (completed !== undefined) task.completed = completed;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assigneeId !== undefined) task.assignee = assigneeId || null;
    if (dueDate !== undefined) task.dueDate = dueDate || null;

    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');

    // Transformar respuesta para asegurar estructura consistente con Frontend
    const responseTask = {
      _id: task._id,
      title: task.title,
      description: task.description,
      sensitive: task.sensitive,
      completed: task.completed,
      userId: task.userId,
      assignee: task.assignee,
      assigneeId: task.assignee, // Para compatibilidad frontend
      projectId: task.projectId,
      status: task.status || 'backlog',
      priority: task.priority || 'medium',
      dueDate: task.dueDate || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };

    return res.status(200).json(responseTask);

  } catch (err) {
    console.error('Error updating task:', err);
    next(err);
  }
};

/**
 * DELETE /api/tasks/:id - Eliminar tarea (ruta plana)
 */
const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Obtener tarea
    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verificar permisos
    if (task.userId.toString() !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this task' });
    }

    // Eliminar
    await Task.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Task deleted successfully' });

  } catch (err) {
    console.error('Error deleting task:', err);
    next(err);
  }
};

module.exports = {
  getProjectTasks,
  createProjectTask,
  getProjectTask,
  updateProjectTask,
  deleteProjectTask,
  markTaskDone,
  getTasks,
  updateTask,
  deleteTask
};
