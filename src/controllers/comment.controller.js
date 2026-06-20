const Comment = require('../models/comment.model');
const Task = require('../models/task.model');
const auditLogService = require('../services/auditLog.service');

/**
 * Obtiene todos los comentarios de una tarea
 * GET /api/tasks/:taskId/comments
 */
const getTaskComments = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

     // PROTECCIÓN DEFENSIVA: Validar que userId existe
     if (!task.userId) {
       return res.status(500).json({ error: 'Task data corrupted' });
     }
     // Verificar permisos (usuario propietario o asignado)
     const taskOwnerId = task.userId.toString?.() || task.userId;
     const taskAssigneeId = task.assignee?.toString?.() || task.assignee;
     
     if (taskOwnerId !== req.user.id && taskAssigneeId !== req.user.id) {
       return res.status(403).json({ error: 'Not authorized' });
     }

     const comments = await Comment.find({ taskId: taskId })
      .populate('userId', 'email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      comments: comments,
      total: comments.length
    });

  } catch (err) {
    console.error('Error getting comments:', err.message);
    next(err);
  }
};

/**
 * Crea un nuevo comentario en una tarea
 * POST /api/tasks/:taskId/comments
 */
const createComment = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // PROTECCIÓN DEFENSIVA: Validar que userId existe
    if (!task.userId) {
      return res.status(500).json({ error: 'Task data corrupted' });
    }
    // Verificar permisos (usuario propietario o asignado)
    const taskOwnerId = task.userId.toString?.() || task.userId;
    const taskAssigneeId = task.assignee?.toString?.() || task.assignee;
    
    if (taskOwnerId !== req.user.id && taskAssigneeId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const comment = new Comment({
      taskId: taskId,
      userId: req.user.id,
      content: content.trim()
    });

    await comment.save();
    await comment.populate('userId', 'email');

    await auditLogService.log('comment.create', req, {
      taskId: taskId,
      commentId: comment._id,
      statusCode: 201,
      details: 'Comment created'
    });

    return res.status(201).json({
      message: 'Comment created successfully',
      comment: comment
    });

  } catch (err) {
    console.error('Error creating comment:', err.message);
    next(err);
  }
};

/**
 * Actualiza un comentario existente
 * PUT /api/comments/:commentId
 */
const updateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // PROTECCIÓN DEFENSIVA: Validar que userId existe
    if (!comment.userId) {
      return res.status(500).json({ error: 'Comment data corrupted' });
    }
    // Verificar que sea el propietario del comentario
    const commentOwnerId = comment.userId.toString?.() || comment.userId;
    if (commentOwnerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    comment.content = content.trim();
    await comment.save();
    await comment.populate('userId', 'email');

    await auditLogService.log('comment.update', req, {
      commentId,
      statusCode: 200,
      details: 'Comment updated'
    });

    return res.status(200).json({
      message: 'Comment updated successfully',
      comment: comment
    });

  } catch (err) {
    console.error('Error updating comment:', err.message);
    next(err);
  }
};

/**
 * Elimina un comentario
 * DELETE /api/comments/:commentId
 */
const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // PROTECCIÓN DEFENSIVA: Validar que userId existe
    if (!comment.userId) {
      return res.status(500).json({ error: 'Comment data corrupted' });
    }
    // Verificar que sea el propietario del comentario
    const commentOwnerId = comment.userId.toString?.() || comment.userId;
    if (commentOwnerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Comment.findByIdAndDelete(commentId);

    await auditLogService.log('comment.delete', req, {
      commentId,
      statusCode: 200,
      details: 'Comment deleted'
    });

    return res.status(200).json({
      message: 'Comment deleted successfully'
    });

  } catch (err) {
    console.error('Error deleting comment:', err.message);
    next(err);
  }
};

module.exports = {
  getTaskComments,
  createComment,
  updateComment,
  deleteComment
};
