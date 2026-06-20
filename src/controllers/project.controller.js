const Project = require('../models/project.model');
const Organization = require('../models/organization.model');
const Membership = require('../models/membership.model');
const auditLogService = require('../services/auditLog.service');

/**
 * GET /api/projects
 * Obtiene todos los proyectos del usuario actual (creados y donde es miembro)
 */
const getMyProjects = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Obtener proyectos creados por el usuario
    const createdProjects = await Project.find({ ownerId: userId })
      .populate('ownerId', 'email')
      .populate('organizationId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Obtener proyectos donde el usuario es miembro (a través de Membership)
    const memberships = await Membership.find({ userId })
      .select('projectId')
      .lean();

    const memberProjectIds = memberships.map(m => m.projectId);

    const memberProjects = memberProjectIds.length > 0
      ? await Project.find({ _id: { $in: memberProjectIds }, ownerId: { $ne: userId } })
          .populate('ownerId', 'email')
          .populate('organizationId', 'name')
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Combinar y eliminar duplicados
    const allProjects = [...createdProjects, ...memberProjects];
    const projectMap = new Map();
    allProjects.forEach(p => {
      projectMap.set(p._id.toString(), p);
    });

    const projects = Array.from(projectMap.values());

    return res.status(200).json({
      success: true,
      projects,
      total: projects.length
    });

  } catch (err) {
    console.error('Error al obtener mis proyectos:', err.message);
    next(err);
  }
};

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
     // PROTECCIÓN DEFENSIVA: Validar que ownerId existe
      const orgOwnerId = organization.ownerId;
      if (!orgOwnerId) {
        console.error('ERROR: Missing organization.ownerId in createProject');
        return res.status(500).json({ error: 'Datos de organización corrompidos' });
      }
      const isCreator = orgOwnerId.toString?.() === userId || orgOwnerId === userId;
      const isAdmin = organization.isOrgAdmin?.(userId) || false;
    
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para crear proyectos en esta organización' });
    }

     // Crear proyecto
     const project = new Project({
       name: name.trim(),
       description: description ? description.trim() : null,
       organizationId,
       ownerId: userId
     });

     await project.save();
     await project.populate('ownerId', 'email');

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
    // PROTECCIÓN DEFENSIVA: Validar que ownerId existe
    const orgOwnerId = organization.ownerId;
    if (!orgOwnerId) {
      console.error('ERROR: Missing organization.ownerId in getOrganizationProjects');
      return res.status(500).json({ error: 'Datos de organización corrompidos' });
    }
    const isCreator = orgOwnerId.toString?.() === userId || orgOwnerId === userId;
    const isMember = organization.members?.some(m => {
      if (!m.userId) return false;
      const memberUserId = m.userId._id ? m.userId._id.toString?.() : m.userId.toString?.();
      return memberUserId === userId;
    }) || false;
    
    if (!isCreator && !isMember) {
      return res.status(403).json({ error: 'No tienes acceso a esta organización' });
    }

    // Obtener proyectos
    const projects = await Project.find({ organizationId })
      .populate('ownerId', 'email')
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

    // Obtener proyecto con populate para ownerId y organizationId (con su ownerId anidado)
    const project = await Project.findById(projectId)
      .populate('ownerId', 'email')
      .populate({
        path: 'organizationId',
        select: 'ownerId members',
        populate: { 
          path: 'ownerId', 
          select: 'email' 
        }
      });

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar acceso - Protección defensiva contra undefined
    const organization = project.organizationId;
    
    // Validación defensiva: si organization no existe, retornar error
    if (!organization) {
      console.error('❌ ERROR CRÍTICO: Organización no encontrada para proyecto:', projectId);
      return res.status(404).json({ error: 'Organización del proyecto no encontrada' });
    }

    // PROTECCIÓN DEFENSIVA: Extraer ownerId del proyecto con múltiples fallbacks
    // Soporta campos: ownerId (ref), _id dentro de ownerId, y fallback a creador
    let pOwnerId = null;
    
    if (project.ownerId) {
      // Si ownerId es un objeto poblado, extraer _id
      if (project.ownerId._id) {
        pOwnerId = project.ownerId._id.toString();
      } 
      // Si ownerId es un ObjectId directo
      else if (typeof project.ownerId.toString === 'function') {
        pOwnerId = project.ownerId.toString();
      } 
      // Si ownerId es una cadena
      else {
        pOwnerId = project.ownerId;
      }
    } 
    // Fallback a campo antiguo 'creador' si existe
    else if (project.creador) {
      if (project.creador._id) {
        pOwnerId = project.creador._id.toString();
      } else if (typeof project.creador.toString === 'function') {
        pOwnerId = project.creador.toString();
      } else {
        pOwnerId = project.creador;
      }
    }

    // PROTECCIÓN DEFENSIVA: Extraer ownerId de la organización
    let orgOwnerId = null;
    
    if (organization.ownerId) {
      if (organization.ownerId._id) {
        orgOwnerId = organization.ownerId._id.toString();
      } else if (typeof organization.ownerId.toString === 'function') {
        orgOwnerId = organization.ownerId.toString();
      } else {
        orgOwnerId = organization.ownerId;
      }
    } 
    else if (organization.creador) {
      if (organization.creador._id) {
        orgOwnerId = organization.creador._id.toString();
      } else if (typeof organization.creador.toString === 'function') {
        orgOwnerId = organization.creador.toString();
      } else {
        orgOwnerId = organization.creador;
      }
    }

    // Log detallado para debugging
    console.log(`🔍 [getProject] Validando acceso para usuario ${userId}`);
    console.log(`   - projectOwnerId: ${pOwnerId || 'UNDEFINED'}`);
    console.log(`   - organizationOwnerId: ${orgOwnerId || 'UNDEFINED'}`);

    // AJUSTE DE FALLBACK: Si falta el ownerId del proyecto, usar el de la organización
    if (!pOwnerId && orgOwnerId) {
      console.warn(`⚠️ AJUSTE DE FALLBACK: project.ownerId undefined, usando organizationOwnerId`);
      pOwnerId = orgOwnerId;
      project.ownerId = organization.ownerId;
    }

    // Verificar acceso con lógica defensiva
    const isCreator = pOwnerId && pOwnerId === userId;
    const isOrgCreator = orgOwnerId && orgOwnerId === userId;
    const isOrgMember = organization.members?.some(m => {
      if (!m.userId) return false;
      const memberUserId = m.userId?._id?.toString() || m.userId?.toString();
      return memberUserId === userId;
    }) || false;
    
    console.log(`   - isCreator: ${isCreator}, isOrgCreator: ${isOrgCreator}, isOrgMember: ${isOrgMember}`);
    
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
        // No lanzar error, permitir que se retorne el proyecto sin descripción
        projectObj.description = null;
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
    const project = await Project.findById(projectId)
      .populate('ownerId', 'email');
    
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // LÓGICA DEFENSIVA: Manejar campos mixtos (ownerId/creador)
    const pOwnerId = project.ownerId?._id?.toString() || project.ownerId?.toString() || project.creador;
    
    if (!pOwnerId) {
      console.error(`❌ ERROR CRÍTICO: project.ownerId es undefined { projectOwnerId: 'UNDEFINED' }`);
      return res.status(500).json({ error: 'Datos del propietario del proyecto corrompidos' });
    }

    // Verificar permisos (creador) con lógica defensiva
    if (pOwnerId !== userId) {
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
    await project.populate('ownerId', 'email');

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
    const project = await Project.findById(projectId)
      .populate('ownerId', 'email');
    
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // LÓGICA DEFENSIVA: Manejar campos mixtos (ownerId/creador)
    const pOwnerId = project.ownerId?._id?.toString() || project.ownerId?.toString() || project.creador;
    
    if (!pOwnerId) {
      console.error(`❌ ERROR CRÍTICO: project.ownerId es undefined { projectOwnerId: 'UNDEFINED' }`);
      return res.status(500).json({ error: 'Datos del propietario del proyecto corrompidos' });
    }

    // Verificar permisos (creador) con lógica defensiva
    if (pOwnerId !== userId) {
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

/**
 * PUT /api/projects/:projectId/archive
 * Archiva un proyecto (solo lectura a partir de entonces)
 */
const archiveProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { ABACContext, abacEngine } = require('../policies/abac.policy');

    // Obtener proyecto
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Crear contexto ABAC
    const context = new ABACContext({
      usuario: req.user,
      recurso: 'project',
      accion: 'archive',
      proyecto: project
    });

    // Evaluar política
    const permitido = await abacEngine.evaluate(context);

    if (!permitido) {
      await auditLogService.logTaskEvent('access.denied', req, {
        recurso: 'project',
        accion: 'archive',
        projectId,
        reason: 'Usuario no tiene permiso para archivar este proyecto'
      });
      return res.status(403).json({ error: 'No tienes permiso para archivar este proyecto' });
    }

    // Archivar proyecto
    project.estado = 'archivado';
    await project.save();
    await project.populate('ownerId', 'email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('project.archived', req, {
      projectId,
      projectName: project.name
    });

    return res.status(200).json({
      mensaje: 'Proyecto archivado exitosamente',
      project
    });

  } catch (err) {
    console.error('Error al archivar proyecto:', err.message);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId/unarchive
 * Desarchiva un proyecto
 */
const unarchiveProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Obtener proyecto
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar permisos (creador o super_admin)
    const isSuperAdmin = req.user.rol === 'super_admin';
    const isCreator = project.ownerId.toString() === userId;

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para desarchivar este proyecto' });
    }

    // Desarchivar proyecto
    project.estado = 'activo';
    await project.save();
    await project.populate('ownerId', 'email');

    // Registrar en auditoría
    await auditLogService.logTaskEvent('project.unarchived', req, {
      projectId,
      projectName: project.name
    });

    return res.status(200).json({
      mensaje: 'Proyecto desarchivado exitosamente',
      project
    });

  } catch (err) {
    console.error('Error al desarchivar proyecto:', err.message);
    next(err);
  }
};

/**
 * GET /api/projects/:projectId/members
 * Obtiene los miembros de la organización asociada al proyecto
 * Retorna un array de usuarios que pertenecen a la organización
 */
const getProjectMembers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Obtener proyecto
    const project = await Project.findById(projectId)
      .populate('organizationId');

    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Obtener organización con miembros poblados
    const organization = await Organization.findById(project.organizationId._id)
      .populate('members.userId', '_id email');

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada' });
    }

    // Validar acceso - PROTECCIÓN DEFENSIVA
    const orgOwnerId = organization.ownerId;
    if (!orgOwnerId) {
      return res.status(500).json({ error: 'Datos de organización corrompidos' });
    }

    const isCreator = orgOwnerId.toString?.() === userId || orgOwnerId === userId;
    const isMember = organization.members?.some(m => {
      if (!m.userId) return false;
      const memberUserId = m.userId._id ? m.userId._id.toString?.() : m.userId.toString?.();
      return memberUserId === userId;
    }) || false;

    if (!isCreator && !isMember) {
      return res.status(403).json({ error: 'No tienes acceso a los miembros de este proyecto' });
    }

    // Transformar miembros a formato compatible con frontend
    const members = organization.members
      .filter(m => m.userId) // Solo incluir miembros con userId válido
      .map(m => ({
        _id: m.userId._id || m.userId.id,
        id: m.userId._id || m.userId.id,
        email: m.userId.email,
        role: m.role
      }));

    return res.status(200).json({
      success: true,
      members,
      total: members.length
    });

  } catch (err) {
    console.error('Error al obtener miembros del proyecto:', err.message);
    next(err);
  }
};

module.exports = {
  getMyProjects,
  createProject,
  getOrganizationProjects,
  getProject,
  updateProject,
  deleteProject,
  archiveProject,
  unarchiveProject,
  getProjectMembers
};
