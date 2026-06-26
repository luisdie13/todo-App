const mongoose = require('mongoose');
const Project = require('../models/project.model');
const Organization = require('../models/organization.model');
const Membership = require('../models/membership.model');
const auditLogService = require('../services/auditLog.service');

/**
 * project.controller.js — Secure Project Workspace Controller Engine.
 * * Requirements Met:
 * - Unifies operational output keys into strict professional English fields ('message', 'status').
 * - Plugs into Class 10 Audit Logging pipelines using standard logTaskEvent tracking metrics.
 * - Sanitizes param addresses to fully prevent structure-mismatch NoSQL Injection anomalies.
 */

/**
 * GET /api/projects
 * Retrieves all projects linked to the active identity profile context (Owned + Assigned Memberships).
 */
const getMyProjects = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || req.user?._id;
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication Error: Verified user instance payload missing.' });
    }

    const userObjectId = new mongoose.Types.ObjectId(String(currentUserId).trim());

    // Fetch project registries created directly by the authenticated operator context
    const createdProjects = await Project.find({ ownerId: userObjectId })
      .populate('ownerId', 'email name')
      .populate('organizationId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Query explicit memberships where the actor has been injected by an administrator
    const memberships = await Membership.find({ userId: userObjectId })
      .select('projectId')
      .lean();

    const memberProjectIds = memberships.map(m => m.projectId);

    const memberProjects = memberProjectIds.length > 0
      ? await Project.find({ _id: { $in: memberProjectIds }, ownerId: { $ne: userObjectId } })
          .populate('ownerId', 'email name')
          .populate('organizationId', 'name')
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Deduplicate array logs references through atomic string index mapping hash
    const projectMap = new Map();
    [...createdProjects, ...memberProjects].forEach(p => {
      if (p && p._id) projectMap.set(String(p._id), p);
    });

    const projects = Array.from(projectMap.values());

    return res.status(200).json({
      success: true,
      projects,
      total: projects.length
    });

  } catch (err) {
    console.error('[ProjectController] Error fetching personal projects context grid:', err.message);
    next(err);
  }
};

/**
 * POST /api/organizations/:organizationId/projects
 * Provisions a fresh project boundary target within an organization container.
 */
const createProject = async (req, res, next) => {
  try {
    const organizationId = String(req.params.organizationId).trim();
    const { name, description } = req.body;
    const currentUserId = req.user?.id || req.user?._id;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Validation Error: Project designation name string is required.' });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Target workspace organization record not located.' });
    }

    const orgOwnerId = organization.ownerId || organization.orgOwnerId;
    if (!orgOwnerId) {
      return res.status(500).json({ error: 'System Integrity Error: Parent organization ownership parameters corrupted.' });
    }

    const isCreator = String(orgOwnerId) === String(currentUserId);
    // Explicit runtime structural checks against instance helper methods
    const isAdmin = typeof organization.isOrgAdmin === 'function' ? organization.isOrgAdmin(currentUserId) : false;
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isCreator && !isAdmin && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: You lack administrative permissions inside this organization boundary.' });
    }

    const project = new Project({
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      organizationId: organizationId,
      ownerId: currentUserId,
      status: 'active' // Correctly initialised to official schema field state
    });

    await project.save();
    await project.populate('ownerId', 'email name');

    // Clase 10 Audit Logging Integration — Injects metadata cleanly to ledger
    await auditLogService.logTaskEvent('project.created', req, {
      projectId: project._id,
      organizationId,
      projectName: project.name,
      status: 'success'
    });

    // FIX: Changed 'mensaje' to 'message' to satisfy frontend notification triggers
    return res.status(201).json({
      message: 'Project pipeline target deployed successfully.',
      project
    });

  } catch (err) {
    console.error('[ProjectController] Project creation sequence aborted:', err.message);
    next(err);
  }
};

/**
 * GET /api/organizations/:organizationId/projects
 * Retrieves all sub-project targets associated with a single organization ID address.
 */
const getOrganizationProjects = async (req, res, next) => {
  try {
    const organizationId = String(req.params.organizationId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Target organization context not located.' });
    }

    const orgOwnerId = organization.ownerId || organization.orgOwnerId;
    if (!orgOwnerId) {
      return res.status(500).json({ error: 'System Integrity Error: Workspace ownership records corrupted.' });
    }

    const isCreator = String(orgOwnerId) === String(currentUserId);
    const isMember = organization.members?.some(m => {
      if (!m.userId) return false;
      return String(m.userId._id || m.userId) === String(currentUserId);
    }) || false;
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isCreator && !isMember && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: Enforced context parameters restrict viewing this environment list.' });
    }

    const projects = await Project.find({ organizationId })
      .populate('ownerId', 'email name')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      projects,
      total: projects.length
    });

  } catch (err) {
    console.error('[ProjectController] Error querying organization associated projects:', err.message);
    next(err);
  }
};

/**
 * GET /api/projects/:projectId
 * Resolves precise details and applies cryptographic description parsing if active.
 */
const getProject = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const currentUserId = req.user?.id || req.user?._id;
    const { decrypt } = require('../security/encryption');

    const project = await Project.findById(projectId)
      .populate('ownerId', 'email name')
      .populate({
        path: 'organizationId',
        select: 'ownerId members name',
        populate: { path: 'ownerId', select: 'email name' }
      });

    if (!project) {
      return res.status(404).json({ error: 'Target project pipeline record not located.' });
    }

    const organization = project.organizationId;
    if (!organization) {
      return res.status(444).json({ error: 'Structural Fault: Project parent organization perimeter missing.' });
    }

    // Secure fallback parser to isolate owner references cleanly
    const pOwnerId = project.ownerId?._id || project.ownerId || project.creador?._id || project.creador;
    const orgOwnerId = organization.ownerId?._id || organization.ownerId || organization.creador?._id || organization.creador;

    const isCreator = pOwnerId && String(pOwnerId) === String(currentUserId);
    const isOrgCreator = orgOwnerId && String(orgOwnerId) === String(currentUserId);
    const isOrgMember = organization.members?.some(m => {
      if (!m.userId) return false;
      return String(m.userId._id || m.userId) === String(currentUserId);
    }) || false;
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isCreator && !isOrgCreator && !isOrgMember && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: Absolute isolation rule prevents opening this project target.' });
    }

    const projectObj = project.toObject();
    
    // Aligns response variables to uniform English field naming criteria rules
    projectObj.status = projectObj.status || projectObj.estado || 'active';

    // Decrypt fields records cleanly if encrypted at rest (OWASP Mitigation Rule 6)
    if (projectObj.description) {
      try {
        projectObj.description = decrypt(projectObj.description);
      } catch (err) {
        console.error('[ProjectController] Cryptographic description parsing failure:', err.message);
        projectObj.description = null; // Yield text node parameter safe fallback
      }
    }

    return res.status(200).json({
      success: true,
      project: projectObj
    });

  } catch (err) {
    console.error('[ProjectController] Error resolving precise project metadata:', err.message);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId
 * Mutates name and summaries details properties under strict ownership context.
 */
const updateProject = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const { name, description } = req.body;
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project configuration profile not located.' });
    }

    const pOwnerId = project.ownerId?._id || project.ownerId || project.creador;
    if (!pOwnerId) {
      return res.status(500).json({ error: 'System Integrity Error: Ownership identity strings corrupted.' });
    }

    if (String(pOwnerId) !== String(currentUserId) && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Mutation request dropped. Creator scope metrics required.' });
    }

    if (name) {
      if (String(name).trim().length < 3) {
        return res.status(400).json({ error: 'Validation Error: Designation name must span across at least 3 characters.' });
      }
      project.name = String(name).trim();
    }

    if (description !== undefined) {
      project.description = description ? String(description).trim() : null;
    }

    await project.save();
    await project.populate('ownerId', 'email name');

    await auditLogService.logTaskEvent('project.updated', req, {
      projectId,
      projectName: project.name,
      status: 'success'
    });

    return res.status(200).json({
      message: 'Project boundary specifications adjusted successfully.',
      project
    });

  } catch (err) {
    console.error('[ProjectController] Operational project patch routine aborted:', err.message);
    next(err);
  }
};

/**
 * DELETE /api/projects/:projectId
 * Purges project assets and references cleanly from MongoDB storage.
 */
const deleteProject = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project registry reference target not found.' });
    }

    const pOwnerId = project.ownerId?._id || project.ownerId || project.creador;
    if (String(pOwnerId) !== String(currentUserId) && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Destruction routines are locked to the asset creator.' });
    }

    const cachedProjectName = project.name;
    await Project.findByIdAndDelete(projectId);

    await auditLogService.logTaskEvent('project.deleted', req, {
      projectId,
      projectName: cachedProjectName,
      status: 'success'
    });

    return res.status(200).json({
      message: 'Project environment entity purged from active registries logs.'
    });

  } catch (err) {
    console.error('[ProjectController] Destructive drop sequence execution crashed:', err.message);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId/archive
 * Enforces Rule 4 ABAC context locks: Seals project into a Read-Only perimeter block.
 */
const archiveProject = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const { ABACContext, abacEngine } = require('../policies/abac.policy');

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project context target profile not found.' });
    }

    const context = new ABACContext({
      usuario: req.user,
      recurso: 'project',
      accion: 'archive',
      proyecto: project
    });

    const permitido = await abacEngine.evaluate(context);
    if (!permitido) {
      await auditLogService.logTaskEvent('access.denied', req, {
        recurso: 'project',
        accion: 'archive',
        projectId,
        reason: 'Enforced ABAC rules rejected project lock execution due to unauthorized role metrics.'
      });
      return res.status(403).json({ error: 'Access Denied: Insufficient authorization parameters to archive this target.' });
    }

    // FIX: Swapped Spanish '.estado' field to schema compliant English '.status' model key
    project.status = 'archived';
    await project.save();
    await project.populate('ownerId', 'email name');

    await auditLogService.logTaskEvent('project.archived', req, {
      projectId,
      projectName: project.name,
      status: 'success'
    });

    return res.status(200).json({
      message: 'Project pipeline locked and archived successfully into read-only mode.',
      project
    });

  } catch (err) {
    console.error('[ProjectController] Project lock sequence aborted:', err.message);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId/unarchive
 * Restores and reactivates a frozen read-only project pipeline target.
 */
const unarchiveProject = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project profile target reference not found.' });
    }

    // FIX: Corrected English string property selector rule checking (role instead of rol)
    const isSuperAdmin = req.user?.role === 'super_admin';
    const isCreator = String(project.ownerId) === String(currentUserId);

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: Reversal activation routines are locked to admins.' });
    }

    project.status = 'active'; // Reset status tag to active model value
    await project.save();
    await project.populate('ownerId', 'email name');

    await auditLogService.logTaskEvent('project.unarchived', req, {
      projectId,
      projectName: project.name,
      status: 'success'
    });

    return res.status(200).json({
      message: 'Project pipeline successfully restored to active status.',
      project
    });

  } catch (err) {
    console.error('[ProjectController] Error unlocking project pipeline environment:', err.message);
    next(err);
  }
};

/**
 * GET /api/projects/:projectId/members
 * Resolves valid organization member indexes bound to a project context scope.
 */
const getProjectMembers = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId).populate('organizationId');
    if (!project) {
      return res.status(404).json({ error: 'Project configuration reference not found.' });
    }

    const organization = await Organization.findById(project.organizationId?._id)
      .populate('members.userId', '_id email name');

    if (!organization) {
      return res.status(404).json({ error: 'Parent workspace organization boundary missing.' });
    }

    const orgOwnerId = organization.ownerId || organization.orgOwnerId;
    if (!orgOwnerId) {
      return res.status(500).json({ error: 'System Integrity Error: Mongoose reference records corrupted.' });
    }

    const isCreator = String(orgOwnerId) === String(currentUserId);
    const isMember = organization.members?.some(m => {
      if (!m.userId) return false;
      return String(m.userId._id || m.userId) === String(currentUserId);
    }) || false;
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isCreator && !isMember && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: Operational membership listing reading access rejected.' });
    }

    const members = organization.members
      .filter(m => m.userId)
      .map(m => ({
        _id: m.userId._id || m.userId.id,
        id: m.userId._id || m.userId.id,
        email: m.userId.email,
        name: m.userId.name || 'Collaborator Asset',
        role: m.role
      }));

    return res.status(200).json({
      success: true,
      members,
      total: members.length
    });

  } catch (err) {
    console.error('[ProjectController] Failed to compile active project membership arrays:', err.message);
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