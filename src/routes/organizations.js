const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organization.controller');
const projectController = require('../controllers/project.controller');
const { authentication } = require('../middleware/authentication');
const validate = require('../middleware/validate');
const { createOrgSchema, updateOrgSchema, inviteSchema } = require('../validators/organization.validator');

// Todas las rutas de organizaciones requieren autenticación
router.use(authentication);

// GET /api/organizations - Mis organizaciones
router.get('/', organizationController.getMyOrganizations);

// POST /api/organizations - Crear organización
router.post('/', validate(createOrgSchema), organizationController.createOrganization);

// GET /api/organizations/:id - Obtener organización por ID
router.get('/:id', organizationController.getOrganization);

// PUT /api/organizations/:id - Actualizar organización
router.put('/:id', validate(updateOrgSchema), organizationController.updateOrganization);

// DELETE /api/organizations/:id - Eliminar organización
router.delete('/:id', organizationController.deleteOrganization);

// POST /api/organizations/:id/invite - Invitar miembro
router.post('/:id/invite', validate(inviteSchema), organizationController.inviteMember);

// DELETE /api/organizations/:id/members/:memberId - Remover miembro
router.delete('/:id/members/:memberId', organizationController.removeMember);

// PROYECTOS DE ORGANIZACIÓN

// POST /api/organizations/:organizationId/projects - Crear proyecto
router.post('/:organizationId/projects', projectController.createProject);

// GET /api/organizations/:organizationId/projects - Obtener proyectos de la organización
router.get('/:organizationId/projects', projectController.getOrganizationProjects);

module.exports = router;
