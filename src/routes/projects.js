const express = require('express');
const router = express.Router();
const { authentication } = require('../middleware/authentication');
const taskController = require('../controllers/task.controller');

/**
 * Rutas de Proyectos y Tareas
 * Utilizan Organization como "Proyecto"
 */

// Middleware de autenticación para todas las rutas
router.use(authentication);

/**
 * GET /api/projects
 * Obtiene "Mis Proyectos" - proyectos creados y proyectos donde el usuario es miembro
 */
router.get('/', async (req, res, next) => {
  try {
    const Organization = require('../models/organization.model');
    const userId = req.user.id;

    // Proyectos creados por el usuario
    const created = await Organization.find({ creador: userId })
      .populate('creador', 'email')
      .populate('miembros.usuario', 'email')
      .sort({ createdAt: -1 })
      .lean();

    // Proyectos donde es miembro
    const memberOf = await Organization.find({
      'miembros.usuario': userId
    })
      .populate('creador', 'email')
      .populate('miembros.usuario', 'email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      projects: {
        created,
        memberOf
      },
      total: created.length + memberOf.length
    });

  } catch (err) {
    console.error('Error al obtener mis proyectos:', err.message);
    next(err);
  }
});

/**
 * GET /api/projects/:projectId
 * Obtiene un proyecto específico
 */
router.get('/:projectId', async (req, res, next) => {
  try {
    const Organization = require('../models/organization.model');
    const Membership = require('../models/membership.model');
    const { projectId } = req.params;
    const userId = req.user.id;

    // Obtener proyecto
    const project = await Organization.findById(projectId)
      .populate('creador', 'email')
      .populate('miembros.usuario', 'email');

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar acceso
    const isCreator = project.creador._id.toString() === userId;
    const membership = await Membership.findOne({
      userId,
      projectId
    });

    if (!isCreator && !membership) {
      return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
    }

    // Obtener información del rol del usuario
    const userRole = isCreator ? 'project_admin' : membership?.role || null;

    return res.status(200).json({
      success: true,
      project,
      userRole
    });

  } catch (err) {
    console.error('Error al obtener proyecto:', err.message);
    next(err);
  }
});

/**
 * TAREAS DEL PROYECTO
 */

/**
 * GET /api/projects/:projectId/tasks
 * Obtiene todas las tareas de un proyecto
 */
router.get('/:projectId/tasks', taskController.getProjectTasks);

/**
 * POST /api/projects/:projectId/tasks
 * Crea una nueva tarea en un proyecto
 */
router.post('/:projectId/tasks', taskController.createProjectTask);

/**
 * GET /api/projects/:projectId/tasks/:taskId
 * Obtiene una tarea específica
 */
router.get('/:projectId/tasks/:taskId', taskController.getProjectTask);

/**
 * PUT /api/projects/:projectId/tasks/:taskId
 * Actualiza una tarea
 */
router.put('/:projectId/tasks/:taskId', taskController.updateProjectTask);

/**
 * DELETE /api/projects/:projectId/tasks/:taskId
 * Elimina una tarea
 */
router.delete('/:projectId/tasks/:taskId', taskController.deleteProjectTask);

module.exports = router;
