const express = require('express');
const router = express.Router();

// 1. Importar el middleware estándar en inglés
const { authentication } = require('../middleware/authentication');

const projectController = require('../controllers/project.controller');
const taskController = require('../controllers/task.controller');

/**
 * projects.js — Secure Project & Kanban Task Routing Engine.
 * * Requirements Met:
 * - Implements isolated sub-routing utilizing explicit mergeParams configurations.
 * - Enforces dynamic token authentication passport hooks across all execution paths.
 * - Provisions role modification path endpoints to support contextual privileges mutations.
 */

// Aplicar autenticación global a este router
router.use(authentication);

/**
 * 2. SUBROUTER PARA TAREAS ANIDADAS
 * (Debe ir ARRIBA de las rutas genéricas para evitar el conflicto de pattern matching)
 */
const tasksRouter = express.Router({ mergeParams: true });

// Forzar la seguridad con el mismo middleware dentro del subrouter
tasksRouter.use(authentication);

// Endpoints del Subrouter para Tareas
tasksRouter.get('/', taskController.getProjectTasks);
tasksRouter.post('/', taskController.createProjectTask);
tasksRouter.get('/:taskId', taskController.getProjectTask);
tasksRouter.put('/:taskId', taskController.updateProjectTask);
tasksRouter.delete('/:taskId', taskController.deleteProjectTask);

// Montar el subrouter primero
router.use('/:projectId/tasks', tasksRouter);


/**
 * 3. RUTAS GENÉRICAS DE PROYECTOS Y MEMBRESÍAS CONTEXTUALES
 */
router.get('/', projectController.getMyProjects);
router.get('/:projectId/members', projectController.getProjectMembers);
router.get('/:projectId', projectController.getProject);
router.put('/:projectId', projectController.updateProject);
router.delete('/:projectId', projectController.deleteProject);
router.put('/:projectId/archive', projectController.archiveProject);
router.put('/:projectId/unarchive', projectController.unarchiveProject);

/**
 * @route   PUT /api/projects/:projectId/members/:memberId/role
 * @desc    Mutates the context taxonomy role of a specific project member.
 * Direct path mapping allowing project_admins to demote to 'viewer' or elevate to 'project_admin'.
 * @access  Private (project_admin, org_admin, or super_admin only)
 */
router.put('/:projectId/members/:memberId/role', (req, res, next) => {
  // If your structural project controller already hosts the updateProjectMemberRole handler
  if (projectController && projectController.updateProjectMemberRole) {
    return projectController.updateProjectMemberRole(req, res, next);
  }
  
  // Dynamic polymorphic fallback fallback mapping into your organization/project controllers layers
  if (projectController && projectController.updateMemberRole) {
    return projectController.updateMemberRole(req, res, next);
  }

  return res.status(501).json({ 
    error: 'Core Endpoint Routing Failure: Targeted project member role mutation controller method missing.' 
  });
});

module.exports = router;