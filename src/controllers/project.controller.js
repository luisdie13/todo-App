const Project = require('../models/project.model');
const Organization = require('../models/organization.model');
const Membership = require('../models/membership.model');
const auditLogService = require('../services/auditLog.service');

/**
 * POST /api/organizations/:organizationId/projects
 * Crea un nuevo proyecto dentro de una organización
 */
const createProject = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    // Validar entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
    }

    // Verificar que la organización existe
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Verificar acceso (crear o admin)
    const isCreator = organization.creador.toString() === userId;
    const isAdmin = organization.esAdmin(userId);
    
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para crear proyectos en esta organización' });
    }

    // Crear proyecto
    const project = new Project({
      name: name.trim(),
      description: description ? description.trim() : null,
      organizationId,
      creador: userId
    });

    await project.save();
    await project.populate('creador', 'email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('project.created', req, {
      projectId: project._id,
      organizationId,
      projectName: project.name
    });

    return res.status(201).json({
      mensaje: 'Proyecto creado exitosamente',
      project
    });

  } catch (err) {
    console.error('Error al crear proyecto:', err.message);
    next(err);
  }
};

/**
 * GET /api/organizations/:organizationId/projects
 * Obtiene todos los proyectos de una organización
 */
const getOrganizationProjects = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.id;

    // Verificar que la organización existe
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Verificar acceso
    const isCreator = organization.creador.toString() === userId;
    const isMember = organization.miembros.some(m => m.usuario.toString() === userId);
    
    if (!isCreator && !isMember) {
      return res.status(403).json({ error: 'No tienes acceso a esta organización' });
    }

    // Obtener proyectos
    const projects = await Project.find({ organizationId })
      .populate('creador', 'email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      projects,
      total: projects.length
    });

  } catch (err) {
    console.error('Error al obtener proyectos:', err.message);
    next(err);
  }
};

/**
 * GET /api/projects/:projectId
 * Obtiene un proyecto específico
 */
const getProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { decrypt } = require('../security/encryption');

    // Obtener proyecto
    const project = await Project.findById(projectId)
      .populate('creador', 'email');

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar acceso
    const organization = await Organization.findById(project.organizationId);
    const isCreator = project.creador._id.toString() === userId;
    const isOrgCreator = organization.creador.toString() === userId;
    const isOrgMember = organization.miembros.some(m => m.usuario.toString() === userId);
    
    if (!isCreator && !isOrgCreator && !isOrgMember) {
      return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
    }

    // Desencriptar descripción si existe
    const projectObj = project.toObject();
    if (projectObj.description) {
      try {
        projectObj.description = decrypt(projectObj.description);
      } catch (err) {
        console.error('Error desencriptando descripción:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      project: projectObj
    });

  } catch (err) {
    console.error('Error al obtener proyecto:', err.message);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId
 * Actualiza un proyecto
 */
const updateProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    // Obtener proyecto
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar permisos (creador)
    if (project.creador.toString() !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este proyecto' });
    }

    // Actualizar campos
    if (name) {
      if (name.trim().length < 3) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres' });
      }
      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = description ? description.trim() : null;
    }

    await project.save();
    await project.populate('creador', 'email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('project.updated', req, {
      projectId,
      projectName: project.name
    });

    return res.status(200).json({
      mensaje: 'Proyecto actualizado exitosamente',
      project
    });

  } catch (err) {
    console.error('Error al actualizar proyecto:', err.message);
    next(err);
  }
};

/**
 * DELETE /api/projects/:projectId
 * Elimina un proyecto
 */
const deleteProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Obtener proyecto
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar permisos (creador)
    if (project.creador.toString() !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este proyecto' });
    }

    // Eliminar proyecto y sus tareas
    await Project.findByIdAndDelete(projectId);

    // Registrar en auditoría
    await auditLogService.logTaskEvent('project.deleted', req, {
      projectId,
      projectName: project.name
    });

    return res.status(200).json({
      mensaje: 'Proyecto eliminado exitosamente'
    });

  } catch (err) {
    console.error('Error al eliminar proyecto:', err.message);
    next(err);
  }
};

module.exports = {
  createProject,
  getOrganizationProjects,
  getProject,
  updateProject,
  deleteProject
};
