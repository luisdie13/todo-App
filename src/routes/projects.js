const express = require('express');
const router = express.Router();
const { authentication } = require('../middleware/authentication');
const projectController = require('../controllers/project.controller');
const taskController = require('../controllers/task.controller');

/**
 * Rutas de Proyectos y Tareas
 */

// Middleware de autenticación para todas las rutas
router.use(authentication);

/**
 * GET /api/projects/:projectId
 * Obtiene un proyecto específico
 */
router.get('/:projectId', projectController.getProject);

/**
 * PUT /api/projects/:projectId
 * Actualiza un proyecto
 */
router.put('/:projectId', projectController.updateProject);

/**
 * DELETE /api/projects/:projectId
 * Elimina un proyecto
 */
router.delete('/:projectId', projectController.deleteProject);

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
