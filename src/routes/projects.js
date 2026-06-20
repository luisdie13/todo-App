const express = require('express');
const router = express.Router();

// 1. Importar el middleware estándar en inglés
const { authentication } = require('../middleware/authentication');

const projectController = require('../controllers/project.controller');
const taskController = require('../controllers/task.controller');

// Aplicar autenticación global a este router
router.use(authentication);

/**
 * 2. SUBROUTER PARA TAREAS ANIDADAS
 * (Debe ir ARRIBA de las rutas genéricas para evitar el conflicto de pattern matching)
 */
const tasksRouter = express.Router({ mergeParams: true });

// Forzar la seguridad con el mismo middleware dentro del subrouter
tasksRouter.use(authentication);

// Endpoints del Subrouter
tasksRouter.get('/', taskController.getProjectTasks);
tasksRouter.post('/', taskController.createProjectTask);
tasksRouter.get('/:taskId', taskController.getProjectTask);
tasksRouter.put('/:taskId', taskController.updateProjectTask);
tasksRouter.delete('/:taskId', taskController.deleteProjectTask);

// Montar el subrouter primero
router.use('/:projectId/tasks', tasksRouter);


/**
 * 3. RUTAS GENÉRICAS DE PROYECTOS
 */
router.get('/', projectController.getMyProjects);
router.get('/:projectId/members', projectController.getProjectMembers);
router.get('/:projectId', projectController.getProject);
router.put('/:projectId', projectController.updateProject);
router.delete('/:projectId', projectController.deleteProject);
router.put('/:projectId/archive', projectController.archiveProject);
router.put('/:projectId/unarchive', projectController.unarchiveProject);

module.exports = router;
