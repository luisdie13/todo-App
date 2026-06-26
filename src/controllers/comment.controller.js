const Comment = require('../models/comment.model');
const Task = require('../models/task.model');
const Project = require('../models/project.model'); // Added to resolve Rule 4 status checks
const auditLogService = require('../services/auditLog.service');

/**
 * comment.controller.js — Secure Task Commentary Management Controller.
 * * Requirements Met:
 * - Syncs model payload properties to match the frontend 'body' schema convention.
 * - Enforces Rule 4 by freezing commentary threads natively if parent project is archived.
 * - Standardizes operational metrics inside the central immutable audit log ledger.
 */

/**
 * GET /api/tasks/:taskId/comments
 * Retrieves all commentary entities bound to a unique task registry.
 */
const getTaskComments = async (req, res, next) => {
  try {
    const taskId = String(req.params.taskId).trim();
    const currentUserId = req.user?._id || req.user?.id;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task perimeter target registry records not found.' });
    }

    if (!task.userId) {
      return res.status(500).json({ error: 'System Integrity Error: Task operational data corrupted.' });
    }

    // Secure identity role check context variables mapping
    const taskOwnerId = task.userId?._id || task.userId;
    const taskAssigneeId = task.assignee?._id || task.assignee;
    
    const isOwner = taskOwnerId && String(taskOwnerId) === String(currentUserId);
    const isAssignee = taskAssigneeId && String(taskAssigneeId) === String(currentUserId);
    const isSuperAdmin = req.user?.role === 'super_admin';

    // Contextual ABAC Authorization validation gate check
    if (!isOwner && !isAssignee && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: You lack roles over this task perimeter.' });
    }

    // Aligned schema definitions cleanly to standard collections fields indices
    const comments = await Comment.find({ taskId: taskId })
      .populate('userId', 'email name')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      comments: comments,
      total: comments.length
    });

  } catch (err) {
    console.error('[CommentController] Failed to query task comments stream:', err.message);
    next(err);
  }
};

/**
 * POST /api/tasks/:taskId/comments
 * Provisions a fresh workspace comment record bound to an active active task pipeline.
 */
const createComment = async (req, res, next) => {
  try {
    const taskId = String(req.params.taskId).trim();
    
    // FIX: Aligned parameter to use 'body' matching exactly your frontend payload structure
    const rawBody = req.body?.body || req.body?.content || req.body?.contenido;
    const cleanBody = rawBody ? String(rawBody).trim() : '';

    if (!cleanBody) {
      return res.status(400).json({ error: 'Validation Error: Comment body text parameters cannot be empty.' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task perimeter target registry records not found.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT: Locked parent project check ─────────
    const parentProject = await Project.findById(task.projectId);
    if (parentProject && parentProject.status === 'archived') {
      return res.status(403).json({ 
        error: 'Locked Boundary Perimeter: Operational modifications are restricted on archived projects.' 
      });
    }

    const taskOwnerId = task.userId?._id || task.userId;
    const taskAssigneeId = task.assignee?._id || task.assignee;
    const currentUserId = req.user?._id || req.user?.id;

    const isOwner = taskOwnerId && String(taskOwnerId) === String(currentUserId);
    const isAssignee = taskAssigneeId && String(taskAssigneeId) === String(currentUserId);
    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isOwner && !isAssignee && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: Action blocked by contextual rule limits.' });
    }

    // Maps instance fields safely according to central Mongoose modeling structures
    const comment = new Comment({
      taskId: taskId,
      userId: currentUserId,
      body: cleanBody // Correct field parameter bound to database schema
    });

    await comment.save();
    await comment.populate('userId', 'email name');

    // Compliance Check: Consolidated to standard logTaskEvent tracking signature methods
    await auditLogService.logTaskEvent('comment.create', req, {
      taskId: taskId,
      commentId: comment._id,
      status: 'success',
      details: 'Collaborator appended a comment entity into active task thread.'
    });

    return res.status(201).json({
      message: 'Comment record deployed successfully.',
      comment: comment
    });

  } catch (err) {
    console.error('[CommentController] Commentary creation lifecycle aborted:', err.message);
    next(err);
  }
};

/**
 * PUT /api/comments/:commentId
 * Mutates an existing comment body specification text.
 */
const updateComment = async (req, res, next) => {
  try {
    const commentId = String(req.params.commentId).trim();
    const rawBody = req.body?.body || req.body?.content || req.body?.contenido;
    const cleanBody = rawBody ? String(rawBody).trim() : '';

    if (!cleanBody) {
      return res.status(400).json({ error: 'Validation Error: Updated comment parameters cannot be empty.' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment registry records not located.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT: Locked parent project check ─────────
    const task = await Task.findById(comment.taskId);
    if (task) {
      const parentProject = await Project.findById(task.projectId);
      if (parentProject && parentProject.status === 'archived') {
        return res.status(403).json({ 
          error: 'Locked Boundary Perimeter: Project is archived. Thread editing features are restricted.' 
        });
      }
    }

    const commentOwnerId = comment.userId?._id || comment.userId;
    const currentUserId = req.user?._id || req.user?.id;

    // Enforces strict creator-only update access criteria controls
    if (!commentOwnerId || String(commentOwnerId) === String(currentUserId)) {
      return res.status(403).json({ error: 'Access Denied: Mutation rejected. You lack comment ownership permissions.' });
    }

    comment.body = cleanBody; // Update explicit aligned database field key
    await comment.save();
    await comment.populate('userId', 'email name');

    await auditLogService.logTaskEvent('comment.update', req, {
      commentId,
      status: 'success',
      details: 'Comment body specifications adjusted by creator context.'
    });

    return res.status(200).json({
      message: 'Comment registry updated successfully.',
      comment: comment
    });

  } catch (err) {
    console.error('[CommentController] Failed to execute comment update patch:', err.message);
    next(err);
  }
};

/**
 * DELETE /api/comments/:commentId
 * Executes a full destructive purge of a unique comment entity from MongoDB.
 */
const deleteComment = async (req, res, next) => {
  try {
    const commentId = String(req.params.commentId).trim();

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment registry records not located.' });
    }

    // ── RULE 4 GOVERNANCE ENFORCEMENT: Locked parent project check ─────────
    const task = await Task.findById(comment.taskId);
    if (task) {
      const parentProject = await Project.findById(task.projectId);
      if (parentProject && parentProject.status === 'archived') {
        return res.status(403).json({ 
          error: 'Locked Boundary Perimeter: Project is archived. Commentary erasure sequences are rejected.' 
        });
      }
    }

    const commentOwnerId = comment.userId?._id || comment.userId;
    const currentUserId = req.user?._id || req.user?.id;

    const isCommentOwner = commentOwnerId && String(commentOwnerId) === String(currentUserId);
    
    // Administrative backup privilege context check tracking rules
    let isBoardAdmin = false;
    if (task) {
      const project = await Project.findById(task.projectId);
      if (project && project.members) {
        isBoardAdmin = project.members.some(m => {
          const memberUserId = m.userId?._id || m.userId;
          return String(memberUserId) === String(currentUserId) && m.role === 'project_admin';
        });
      }
    }

    const isSuperAdmin = req.user?.role === 'super_admin';

    if (!isCommentOwner && !isBoardAdmin && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access Denied: Action aborted. You lack sufficient administrative roles.' });
    }

    await Comment.findByIdAndDelete(commentId);

    await auditLogService.logTaskEvent('comment.delete', req, {
      commentId,
      status: 'success',
      details: 'Commentary entry record dropped from structural storage.'
    });

    return res.status(200).json({
      message: 'Comment entry dropped successfully from tracking system.'
    });

  } catch (err) {
    console.error('[CommentController] Destructive drop sequence aborted:', err.message);
    next(err);
  }
};

module.exports = {
  getTaskComments,
  createComment,
  updateComment,
  deleteComment
};