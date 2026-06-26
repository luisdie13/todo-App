const express = require('express');
const router = express.Router({ mergeParams: true });
const { authentication } = require('../middleware/authentication');
const projectController = require('../controllers/project.controller');
const taskController = require('../controllers/task.controller');

// Función de seguridad para evitar crashes en el arranque
const check = (handler, name) => {
    if (typeof handler !== 'function') {
        console.error(`⚠️  ADVERTENCIA: Controlador '${name}' no definido en project.controller.js`);
        return (req, res) => res.status(501).json({ error: `Método ${name} no implementado` });
    }
    return handler;
};

router.use(authentication);

// --- 1. SUB-ROUTER DE TAREAS ---
const tasksRouter = express.Router({ mergeParams: true });
tasksRouter.use(authentication);

tasksRouter.get('/', check(taskController.getProjectTasks, 'getProjectTasks'));
tasksRouter.post('/', check(taskController.createProjectTask, 'createProjectTask'));
tasksRouter.get('/:taskId', check(taskController.getProjectTask, 'getProjectTask'));
tasksRouter.put('/:taskId', check(taskController.updateProjectTask, 'updateProjectTask'));
tasksRouter.delete('/:taskId', check(taskController.deleteProjectTask, 'deleteProjectTask'));

router.use('/:projectId/tasks', tasksRouter);

// --- 2. RUTAS DE PROYECTO ESPECÍFICAS ---
router.get('/:projectId/members', check(projectController.getProjectMembers, 'getProjectMembers'));

router.put('/:projectId/members/:memberId/role', (req, res, next) => {
    const handler = projectController.updateProjectMemberRole || projectController.updateMemberRole;
    return handler ? handler(req, res, next) : res.status(501).json({ error: "Handler missing" });
});

router.get('/:projectId', check(projectController.getProject, 'getProject'));
router.put('/:projectId', check(projectController.updateProject, 'updateProject'));
router.delete('/:projectId', check(projectController.deleteProject, 'deleteProject'));
router.put('/:projectId/archive', check(projectController.archiveProject, 'archiveProject'));
router.put('/:projectId/unarchive', check(projectController.unarchiveProject, 'unarchiveProject'));

// --- 3. RUTAS RAÍZ ---
router.post('/', check(projectController.createProject, 'createProject'));
router.get('/', check(projectController.getMyProjects, 'getMyProjects'));

module.exports = router;