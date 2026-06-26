const Task = require('../models/task.model');
const Organization = require('../models/organization.model');
const Membership = require('../models/membership.model');
const Project = require('../models/project.model');
const auditLogService = require('../services/auditLog.service');

/**
 * task.controller.js — Secure Task Context Lifecycle Controller Engine.
 * * Requirements Met:
 * - Enforces Rule 4 Governance criteria by freezing all mutations if a project is 'archived'.
 * - Sanitizes dynamic param route endpoints against destructive NoSQL Injection vectors.
 * - Captures actions across both contextual and flat routes using logTaskEvent (Class 10).
 */

/**
 * GET /api/projects/:projectId/tasks
 * Retrieves all structural task models associated with a verified project boundary.
 */
const getProjectTasks = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project perimeter target records not found.' });
    }

    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Parent workplace organization boundary does not exist.' });
    }

    const projectOwnerId = project.ownerId;
    const orgOwnerId = organization.ownerId || organization.orgOwnerId;
    
    if (!projectOwnerId || !orgOwnerId) {
      return res.status(500).json({ error: 'System Integrity Error: Structural data ownership records corrupted.' });
    }

    const isProjectCreator = String(projectOwnerId) === String(currentUserId);
    const isOrgCreator = String(orgOwnerId) === String(currentUserId);
    
    const isOrgMember = organization.members?.some(m => {
      if (!m.userId) return false;
      return String(m.userId._id || m.userId) === String(currentUserId);
    }) || false;

    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isProjectCreator && !isOrgCreator && !isOrgMember && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: Absolute isolation rule restricts viewing this board.' });
    }

    const tasks = await Task.find({ projectId })
      .populate('userId', 'email name')
      .populate('assignee', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Data normalizer array builder mapping fields to secure uniform frontend keys
    const safeTasks = tasks.map(task => ({
      _id: task._id,
      id: task._id,
      title: task.title,
      description: task.description,
      sensitive: !!task.sensitive,
      completed: !!task.completed,
      userId: task.userId,
      assignee: task.assignee,
      assigneeId: task.assignee?._id || task.assignee || null,
      projectId: task.projectId,
      status: task.status || 'backlog',
      priority: task.priority || 'medium',
      dueDate: task.dueDate || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));

    return res.status(200).json(safeTasks);

  } catch (err) {
    console.error('[TaskController] Failed to compile project tasks grid stream:', err);
    next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks
 * Provisions a fresh task model into an active project partition.
 */
const createProjectTask = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const { title, description, sensitive = false, assigneeId = null, dueDate = null, priority = 'medium', status = 'backlog' } = req.body;
    const currentUserId = req.user?.id || req.user?._id;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Validation Error: Task specification title is required.' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Target project record not found.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT: Locked parent project check ─────────
    if (project.status === 'archived') {
      return res.status(403).json({ error: 'Locked Boundary Perimeter: Project is archived. Adding new items is restricted.' });
    }

    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return res.status(500).json({ error: 'System Integrity Error: Parent organization missing.' });
    }
    
    const membership = await Membership.findOne({ userId: currentUserId, projectId: projectId }) || 
                       await Membership.findOne({ userId: currentUserId, organizationId: organization._id });
                       
    const isSuperAdmin = req.user?.role === 'super_admin';
    const isProjectOwner = String(project.ownerId) === String(currentUserId);

    if (!membership && !isSuperAdmin && !isProjectOwner) {
      await auditLogService.logTaskEvent("task.unauthorized_access", req, {
        projectId,
        action: "CREATE",
        reason: "User lacks assignment membership records over project perimeter."
      });
      return res.status(403).json({ error: "Access Denied: Membership credentials required." });
    }

    // Rule 2 Enforcement: Block write access vectors for explicit 'viewer' roles
    if (membership && membership.role === "viewer" && !isSuperAdmin) {
      await auditLogService.logTaskEvent("task.unauthorized_access", req, {
        projectId,
        action: "CREATE",
        reason: "Viewer role context blocked from provisioning write items."
      });
      return res.status(403).json({ error: "Access Denied: View-Only session tokens block adding task payload assets." });
    }

    const task = new Task({
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      sensitive: sensitive === true,
      userId: currentUserId,
      assignee: assigneeId || null,
      projectId: projectId,
      priority: priority || 'medium',
      status: status || 'backlog',
      dueDate: dueDate || null
    });

    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');

    await auditLogService.logTaskEvent('task.create', req, {
      taskId: task._id,
      projectId,
      taskTitle: task.title,
      status: 'success'
    });

    return res.status(201).json({
      message: 'Task specification resource created successfully.',
      task: {
        _id: task._id,
        id: task._id,
        title: task.title,
        description: task.description,
        sensitive: task.sensitive,
        completed: task.completed,
        userId: task.userId,
        assignee: task.assignee,
        assigneeId: task.assignee?._id || task.assignee || null,
        projectId: task.projectId,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate
      }
    });

  } catch (err) {
    console.error('[TaskController] Error expanding project task entries pool:', err);
    next(err);
  }
};

/**
 * GET /api/projects/:projectId/tasks/:taskId
 */
const getProjectTask = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const taskId = String(req.params.taskId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project perimeter target records not found.' });
    }

    const membership = await Membership.findOne({ userId: currentUserId, projectId }) || 
                       await Membership.findOne({ userId: currentUserId, organizationId: project.organizationId });
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!membership && !isSuperAdmin && String(project.ownerId) !== String(currentUserId)) {
      return res.status(403).json({ error: 'Access Denied: Absolute isolation restricts viewing this task profile.' });
    }

    const task = await Task.findOne({ _id: taskId, projectId })
      .populate('userId', 'email name')
      .populate('assignee', 'name email');

    if (!task) {
      return res.status(404).json({ error: 'Target task registry profile not located.' });
    }

    return res.status(200).json({ success: true, task });

  } catch (err) {
    console.error('[TaskController] Unique task metadata lookup crashed:', err);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId
 * Context Route variant used to adjust specific task metrics within project containers.
 */
const updateProjectTask = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const taskId = String(req.params.taskId).trim();
    const { title, description, completed, status, priority, assigneeId, dueDate } = req.body;
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Parent project reference address not found.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT: Locked parent project check ─────────
    if (project.status === 'archived') {
      return res.status(403).json({ error: 'Locked Boundary Perimeter: Project is archived. Configuration changes are restricted.' });
    }

    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) {
      return res.status(404).json({ error: 'Task asset specifications target records not found.' });
    }

    const { canEditTask } = require('../middleware/checkPermission');
    const canEdit = await canEditTask(req.user, task) || req.user?.role === 'super_admin';

    if (!canEdit) {
      await auditLogService.logTaskEvent('task.unauthorized_access', req, {
        taskId,
        projectId,
        action: 'UPDATE',
        reason: 'User session tokens lack credentials parameters over this asset.'
      });
      return res.status(403).json({ error: 'Access Denied: You lack permissions to modify this task.' });
    }

    if (title) task.title = String(title).trim();
    if (description !== undefined) task.description = description ? String(description).trim() : null;
    if (completed !== undefined) task.completed = !!completed;
    if (status) task.status = String(status).trim();
    if (priority) task.priority = String(priority).trim();
    if (assigneeId !== undefined) task.assignee = assigneeId || null;
    if (dueDate !== undefined) task.dueDate = dueDate || null;

    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');

    await auditLogService.logTaskEvent('task.update', req, {
      taskId,
      projectId,
      taskTitle: task.title,
      status: 'success'
    });

    return res.status(200).json({
      message: 'Task profile parameters updated successfully.',
      task
    });

  } catch (err) {
    console.error('[TaskController] Context update request execution failure:', err);
    next(err);
  }
};

/**
 * DELETE /api/projects/:projectId/tasks/:taskId
 */
const deleteProjectTask = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const taskId = String(req.params.taskId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Parent project reference address not found.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT ──────────────────────────────────────
    if (project.status === 'archived') {
      return res.status(403).json({ error: 'Locked Boundary Perimeter: Project is archived. Resource destruction sequences are rejected.' });
    }

    const task = await Task.findOne({ _id: taskId, projectId });
    if (!task) {
      return res.status(404).json({ error: 'Target task registry records not located.' });
    }

    const membership = await Membership.findOne({ userId: currentUserId, projectId });
    const isSuperAdmin = req.user?.role === 'super_admin';
    const isTaskOwner = String(task.userId) === String(currentUserId);
    const isBoardAdmin = membership && (typeof membership.isAdmin === 'function' ? membership.isAdmin() : membership.role === 'project_admin');

    if (!isSuperAdmin && !isBoardAdmin && (!isTaskOwner || (membership && membership.role === 'viewer'))) {
      await auditLogService.logTaskEvent('task.unauthorized_deletion', req, {
        taskId,
        projectId,
        reason: 'Operator context metrics lack sufficient roles parameters to delete resource.'
      });
      return res.status(403).json({ error: 'Access Denied: Task erasure rejected.' });
    }

    await Task.findByIdAndDelete(taskId);

    await auditLogService.logTaskEvent('task.delete', req, {
      taskId,
      projectId,
      taskTitle: task.title,
      status: 'success'
    });

    return res.status(200).json({
      message: 'Task environment record deleted successfully.'
    });

  } catch (err) {
    console.error('[TaskController] Context drop procedure aborted by server:', err);
    next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/mark-done
 */
const markTaskDone = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const taskId = String(req.params.taskId).trim();
    const { ABACContext, abacEngine } = require('../policies/abac.policy');

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project configuration addresses missing.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT ──────────────────────────────────────
    if (project.status === 'archived') {
      return res.status(403).json({ error: 'Locked Boundary Perimeter: Project is archived. Transition requests are blocked.' });
    }

    const task = await Task.findOne({ _id: taskId, projectId }).populate('userId assignee', 'name email');
    if (!task) {
      return res.status(404).json({ error: 'Task profile data entries not found.' });
    }

    const context = new ABACContext({
      user: req.user,
      resource: 'task',
      action: 'mark_done',
      project,
      resourceId: taskId,
      resourceObj: task
    });

    const allowed = await abacEngine.evaluate(context);
    if (!allowed) {
      await auditLogService.logTaskEvent('access.denied', req, {
        resource: 'task',
        action: 'mark_done',
        projectId,
        taskId,
        reason: 'Enforced ABAC boundary checks rejected task transition command.'
      });
      return res.status(403).json({ error: 'Access Denied: Context metrics prevent marking this asset as completed.' });
    }

    task.completed = true;
    task.status = 'done';
    await task.save();

    await auditLogService.logTaskEvent('task.status_change', req, {
      taskId,
      projectId,
      taskTitle: task.title,
      status: 'success',
      details: 'Task context state flags successfully forced to completed.'
    });

    return res.status(200).json({
      message: 'Task resource state completed successfully.',
      task
    });

  } catch (err) {
    console.error('[TaskController] Exception inside ABAC status mark transition stream:', err);
    next(err);
  }
};

/**
 * GET /api/tasks
 * Flat route variant loading active tasks matching direct creator identifiers.
 */
const getTasks = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || req.user?._id;
    
    const tasks = await Task.find({ userId: currentUserId })
      .populate('userId', 'email name')
      .populate('assignee', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    return res.status(200).json(tasks);
  } catch (err) {
    console.error('[TaskController] Flat query registries lookup failed:', err);
    next(err);
  }
};

/**
 * PUT /api/tasks/:id
 * Flat route unifier linked to Frontend Kanban Board updates.
 */
const updateTask = async (req, res, next) => {
  try {
    const taskId = String(req.params.id).trim();
    const { title, description, completed, status, priority, assigneeId, dueDate } = req.body;
    const currentUserId = req.user?.id || req.user?._id;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task target context registry not located.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT: Cross check parent project status ───
    const parentProject = await Project.findById(task.projectId);
    if (parentProject && parentProject.status === 'archived') {
      return res.status(403).json({ error: 'Locked Boundary Perimeter: Project is archived. Task updates across flat channels are denied.' });
    }

    const isOwner = String(task.userId) === String(currentUserId);
    const isAssignee = task.assignee && String(task.assignee) === String(currentUserId);
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isOwner && !isAssignee && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: You possess no active connection parameters over this asset.' });
    }

    if (title) task.title = String(title).trim();
    if (description !== undefined) task.description = description ? String(description).trim() : null;
    if (completed !== undefined) task.completed = !!completed;
    if (status) task.status = String(status).trim();
    if (priority) task.priority = String(priority).trim();
    if (assigneeId !== undefined) task.assignee = assigneeId || null;
    if (dueDate !== undefined) task.dueDate = dueDate || null;

    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');

    // Clase 10 Logging for Flat Route pipelines
    await auditLogService.logTaskEvent('task.update', req, {
      taskId: task._id,
      projectId: task.projectId,
      taskTitle: task.title,
      status: 'success'
    });

    return res.status(200).json({
      success: true,
      task: {
        _id: task._id,
        id: task._id,
        title: task.title,
        description: task.description,
        sensitive: task.sensitive,
        completed: task.completed,
        userId: task.userId,
        assignee: task.assignee,
        assigneeId: task.assignee?._id || task.assignee || null,
        projectId: task.projectId,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    });

  } catch (err) {
    console.error('[TaskController] Flat route execution update workflow failed:', err);
    next(err);
  }
};

/**
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res, next) => {
  try {
    const taskId = String(req.params.id).trim();
    const currentUserId = req.user?.id || req.user?._id;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task target context registry not located.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT ──────────────────────────────────────
    const parentProject = await Project.findById(task.projectId);
    if (parentProject && parentProject.status === 'archived') {
      return res.status(403).json({ error: 'Locked Boundary Perimeter: Project is archived. Resource drops are blocked.' });
    }

    if (String(task.userId) !== String(currentUserId) && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Destruction routines are locked to the task owner.' });
    }

    await Task.findByIdAndDelete(taskId);

    await auditLogService.logTaskEvent('task.delete', req, {
      taskId,
      projectId: task.projectId,
      taskTitle: task.title,
      status: 'success'
    });

    return res.status(200).json({ success: true, message: 'Task entity dropped successfully from structural storage.' });

  } catch (err) {
    console.error('[TaskController] Flat route destructive drop sequence crashed:', err);
    next(err);
  }
};

module.exports = {
  getProjectTasks,
  createProjectTask,
  getProjectTask,
  updateProjectTask,
  deleteProjectTask,
  markTaskDone,
  getTasks,
  updateTask,
  deleteTask
};