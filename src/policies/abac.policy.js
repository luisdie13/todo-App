/**
 * ABAC Engine (Attribute-Based Access Control)
 * 
 * Provides a flexible attribute-based access control system:
 * - user (global role, special permissions)
 * - resource (type, status, owner)
 * - context (requested action, organization, project)
 * 
 * Policies are defined as functions that return true/false
 */

const Membership = require('../models/membership.model');
const Project = require('../models/project.model');
const User = require('../models/user.model');

/**
 * ABAC Context - complete information for policy evaluation
 */
class ABACContext {
  constructor({
    user,
    resource,
    action,
    organization = null,
    project = null,
    resourceId = null,
    resourceObj = null
  }) {
    this.user = user; // req.user
    this.resource = resource; // 'task', 'project', 'organization'
    this.action = action; // 'read', 'create', 'update', 'delete', 'mark_done'
    this.organization = organization;
    this.project = project;
    this.resourceId = resourceId;
    this.resourceObj = resourceObj;
  }
}

/**
 * ABAC Engine - evaluates policies
 */
class ABACEngine {
  constructor() {
    this.policies = new Map();
    this.registerDefaultPolicies();
  }

  /**
   * Registers a policy
   * @param {String} key - Unique identifier (e.g.: "task.read")
   * @param {Function} evaluator - Function that returns true if allowed
   */
  registerPolicy(key, evaluator) {
    this.policies.set(key, evaluator);
  }

  /**
   * Evaluates if an action is allowed
   * @param {ABACContext} context - Context for evaluation
   * @returns {Promise<Boolean>}
   */
  async evaluate(context) {
    const policyKey = `${context.resource}.${context.action}`;
    
    if (!this.policies.has(policyKey)) {
      console.warn(`No policy found for: ${policyKey}`);
      return false;
    }

    try {
      const policy = this.policies.get(policyKey);
      return await policy(context);
    } catch (err) {
      console.error(`Error evaluating policy ${policyKey}:`, err);
      return false;
    }
  }

  /**
   * Registers all default policies
   */
  registerDefaultPolicies() {
    // ===== TASK POLICIES =====
    this.registerPolicy('task.read', async (ctx) => {
      const { user, project, resourceObj } = ctx;

      // Super admin can read any task
      if (user.role === 'super_admin') return true;

      // If there's no project, only the owner can read
      if (!project) return false;

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      if (!membership) return false;

      // All roles can read (project_admin, developer, viewer)
      return membership.canRead();
    });

    this.registerPolicy('task.create', async (ctx) => {
      const { user, project } = ctx;

      // Super admin can create tasks in any project
      if (user.role === 'super_admin') return true;

      // Without project, only authenticated users can create
      if (!project) return true;

      // Archived project: cannot create tasks
      if (project.status === 'archived') return false;

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      if (!membership) return false;

      // Only project_admin and developer can create
      return membership.canWrite();
    });

    this.registerPolicy('task.update', async (ctx) => {
      const { user, project, resourceObj: task } = ctx;

      // Super admin can update any task
      if (user.role === 'super_admin') return true;

      // Archived project: cannot update tasks
      if (project && project.status === 'archived') return false;

      // Without project, only the owner can update
      if (!project) {
        if (!task.userId) return false;
        return task.userId.toString?.() === user.id || task.userId === user.id;
      }

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      if (!membership) return false;

      // project_admin can edit any task
      if (membership.isAdmin()) return true;

      // developer can only edit their own tasks
      if (membership.hasRole('developer')) {
        return task.userId.toString() === user.id;
      }

      // viewer cannot update
      return false;
    });

    this.registerPolicy('task.delete', async (ctx) => {
      const { user, project, resourceObj: task } = ctx;

      // Super admin can delete any task
      if (user.role === 'super_admin') return true;

      // Archived project: cannot delete tasks
      if (project && project.status === 'archived') return false;

      // Without project, only the owner can delete
      if (!project) {
        if (!task.userId) return false;
        return task.userId.toString?.() === user.id || task.userId === user.id;
      }

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      if (!membership) return false;

      // Only project_admin can delete
      return membership.isAdmin();
    });

    this.registerPolicy('task.mark_done', async (ctx) => {
      const { user, project, resourceObj: task } = ctx;

      // Super admin can mark any task as done
      if (user.role === 'super_admin') return true;

      // Archived project: cannot mark tasks as done
      if (project && project.status === 'archived') return false;

      // Without project, only the owner can mark as done
      if (!project) {
        if (!task.userId) return false;
        return task.userId.toString?.() === user.id || task.userId === user.id;
      }

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      if (!membership) return false;

      // project_admin can mark any task as done
      if (membership.isAdmin()) return true;

      // developer and assignee can mark only their own tasks as done
      if (membership.hasRole('developer')) {
        // If the task has assignee, only the assignee can mark as done
        if (task.assignee) {
          const assigneeId = task.assignee.toString?.() || task.assignee;
          return assigneeId === user.id;
        }
        // If no assignee, the owner can mark as done
        if (!task.userId) return false;
        const taskOwnerId = task.userId.toString?.() || task.userId;
        return taskOwnerId === user.id;
      }

      // viewer cannot mark as done
      return false;
    });

    // ===== PROJECT POLICIES =====
    this.registerPolicy('project.read', async (ctx) => {
      const { user, project } = ctx;

      // Super admin can read any project
      if (user.role === 'super_admin') return true;

      if (!project) return false;

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      if (membership) return true;

      // Project creator can read it
      if (project.ownerId?.toString() === user.id) return true;

      return false;
    });

    this.registerPolicy('project.update', async (ctx) => {
      const { user, project } = ctx;

      // Super admin can update any project
      if (user.role === 'super_admin') return true;

      if (!project) return false;

      // Archived project: cannot update
      if (project.status === 'archived') return false;

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      // Only project_admin can update
      if (membership && membership.isAdmin()) return true;

      // Project creator can update it
      if (project.ownerId?.toString() === user.id) return true;

      return false;
    });

    this.registerPolicy('project.delete', async (ctx) => {
      const { user, project } = ctx;

      // Super admin can delete any project
      if (user.role === 'super_admin') return true;

      if (!project) return false;

      // Project creator can delete it
      return project.ownerId?.toString() === user.id;
    });

    this.registerPolicy('project.archive', async (ctx) => {
      const { user, project } = ctx;

      // Super admin can archive any project
      if (user.role === 'super_admin') return true;

      if (!project) return false;

      // Check membership
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: project._id
      });

      // Only project_admin can archive
      if (membership && membership.isAdmin()) return true;

      // Project creator can archive it
      return project.ownerId?.toString() === user.id;
    });

    // ===== AUDIT POLICIES =====
    this.registerPolicy('audit.read', async (ctx) => {
      const { user } = ctx;

      // Only super_admin can view audit logs
      return user.role === 'super_admin';
    });

    this.registerPolicy('organization.view_members', async (ctx) => {
      const { user, organization } = ctx;

      // Super admin can view members of any organization
      if (user.role === 'super_admin') return true;

      if (!organization) return false;

      // Organization owner can view members
      if (organization.ownerId.toString() === user.id) return true;

      // Organization members can view other members
      return organization.members.some(m => m.userId.toString() === user.id);
    });

     this.registerPolicy('organization.edit', async (ctx) => {
       const { user, organization } = ctx;

       // Super admin can edit any organization
       if (user.role === 'super_admin') return true;

       if (!organization) return false;

       // Only the organization owner can edit it
       return organization.ownerId.toString() === user.id;
     });

     // ===== PROJECT CREATION POLICY =====
     this.registerPolicy('project.create', async (ctx) => {
       const { user, organization } = ctx;

       // Super admin can create projects in any organization
       if (user.role === 'super_admin') return true;

       if (!organization) return false;

       // Organization owner can create projects
       if (organization.ownerId.toString() === user.id) return true;

       // Organization admin can create projects
       if (organization.members && Array.isArray(organization.members)) {
         const isMember = organization.members.some(m => 
           m.userId.toString() === user.id && m.role === 'org_admin'
         );
         if (isMember) return true;
       }

       return false;
     });

     // ===== ORGANIZATION CREATE_PROJECT POLICY (alias for project.create in org context) =====
     this.registerPolicy('organization.create_project', async (ctx) => {
       const { user, organization } = ctx;

       // Super admin can create projects in any organization
       if (user.role === 'super_admin') return true;

       if (!organization) return false;

       // Organization owner can create projects
       if (organization.ownerId.toString() === user.id) return true;

       // Organization admin can create projects
       if (organization.members && Array.isArray(organization.members)) {
         const isMember = organization.members.some(m => 
           m.userId.toString() === user.id && m.role === 'org_admin'
         );
         if (isMember) return true;
       }

       return false;
     });
   }
}

// Global instance of the ABAC engine
const abacEngine = new ABACEngine();

module.exports = {
  ABACContext,
  abacEngine
};
