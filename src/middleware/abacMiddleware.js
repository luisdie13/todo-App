/**
 * Middleware ABAC
 * Proporciona funciones para verificar permisos basadas en atributos
 */

const { ABACContext, abacEngine } = require('../policies/abac.policy');
const Project = require('../models/project.model');
const Organization = require('../models/organization.model');
const Task = require('../models/task.model');
const auditLogService = require('../services/auditLog.service');

/**
 * Verifies permission using ABAC
 * @param {String} resource - Resource type ('task', 'project', 'organization')
 * @param {String} action - Action to verify ('read', 'create', 'update', 'delete', 'mark_done')
 * @returns {Function} Express middleware
 */
const checkABACPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
       const user = req.user;
       let project = null;
       let organization = null;
       let resourceObj = null;

      // Get the project if necessary
      if (req.params.projectId) {
        project = await Project.findById(req.params.projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
      }

      // Get the organization if necessary
      if (req.params.organizationId) {
        organization = await Organization.findById(req.params.organizationId);
        if (!organization) {
          return res.status(404).json({ error: 'Organization not found' });
        }
      }

      // Get the specific resource if necessary
      if (resource === 'task' && req.params.taskId) {
        resourceObj = await Task.findById(req.params.taskId);
        if (!resourceObj) {
          return res.status(404).json({ error: 'Task not found' });
        }
      }

      // Create ABAC context
      const context = new ABACContext({
        user,
        resource,
        action,
        organization,
        project,
        resourceObj
      });

      // Evaluate policy
      const allowed = await abacEngine.evaluate(context);

      if (!allowed) {
        // Log unauthorized attempt
        await auditLogService.logTaskEvent('access.denied', req, {
          resource,
          action,
          projectId: project?._id,
          organizationId: organization?._id,
          resourceId: resourceObj?._id,
          reason: `User does not have permission to ${action} ${resource}`
        });

        return res.status(403).json({
          error: `You do not have permission to ${action} this ${resource}`
        });
      }

      // Save in req for later use
      req.project = project;
      req.organization = organization;
      req.resourceObj = resourceObj;

      next();
    } catch (err) {
      console.error(`Error in checkABACPermission (${resource}.${action}):`, err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Verifies if a user is super_admin
 */
const checkSuperAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') {
      await auditLogService.logTaskEvent('access.denied', req, {
        reason: 'Access only for super_admin'
      });
      return res.status(403).json({ error: 'Only super_admin can access this resource' });
    }
    next();
  } catch (err) {
    console.error('Error in checkSuperAdmin:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Verifies if a project is archived
 */
const checkProjectNotArchived = async (req, res, next) => {
  try {
    if (req.project && req.project.status === 'archived') {
      return res.status(403).json({
        error: 'Cannot make changes to archived projects'
      });
    }
    next();
  } catch (err) {
    console.error('Error in checkProjectNotArchived:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  checkABACPermission,
  checkSuperAdmin,
  checkProjectNotArchived
};
