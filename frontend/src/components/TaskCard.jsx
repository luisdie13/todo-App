import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import {
  canEditTask,
  canDeleteTask,
  canMarkDone,
  isViewer,
  getTaskActions
} from '../utils/permissions';
import CommentSection from './CommentSection';

/**
 * TaskCard Component
 * Displays a single task unit enforcing rigorous runtime ABAC protections
 * and OWASP sanitization baselines before injection into the DOM tree.
 *
 * Props:
 * - task: Task data entity from database registry
 * - user: Authenticated global system user object
 * - membership: User context role inside this project
 * - project: Parent project schema containing status metadata
 * - onEdit: Callback function to trigger task mutation
 * - onDelete: Callback function to trigger data destruction
 * - onMarkDone: Callback function to transition status to 'done'
 */
const TaskCard = ({
  task,
  user,
  membership,
  project,
  onEdit,
  onDelete,
  onMarkDone
}) => {
  const [showComments, setShowComments] = useState(false);
  
  // Resolve runtime ABAC permissions layout matrix for this specific task
  const actions = getTaskActions(user, task, membership, project);
  
  // Verify context permission restrictions
  const isOnlyViewer = isViewer(membership);

  // Terminate execution pipeline early if the actor fails cross-origin read authorization
  if (!actions.read) {
    return null;
  }

  // ── DOMPurify Sanitization Helper ──────────────────────────────────────────
  const sanitize = (value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  };

  // ── ABAC Sensitivity Context Evaluator (Rule 6) ───────────────────────────
  const hasAccessToSensitiveContent = () => {
    if (!task.sensitive) return true;
    
    // Explicit project admin role grant
    const isProjectAdmin = membership?.role === 'project_admin';
    
    // Explicit task assignee identity verification
    const assigneeId = task.assigneeId || task.assignee?._id || task.assignee;
    const isAssignee = user && assigneeId && String(user._id || user.id) === String(assigneeId);
    
    return isProjectAdmin || isAssignee;
  };

  const isProjectArchived = project?.status === 'archived';
  const hasAccess = hasAccessToSensitiveContent();

  // Sanitize data nodes to eliminate injection/XSS vectors
  const cleanTitle = sanitize(task.title);
  const rawDescription = hasAccess 
    ? (task.description || '') 
    : '🔒 [RESTRICTED CONTENT] — Unauthorized contextual role permissions.';
  const cleanDescription = sanitize(rawDescription);
  const assigneeEmail = sanitize(task.assignee?.email || task.assignee);

  return (
    <div className={`task-card ${task.status === 'done' ? 'completed' : ''} ${isProjectArchived ? 'archived' : ''}`}>
      <div className="task-header">
        <h3 className="task-title">{cleanTitle}</h3>
        
        {isProjectArchived && (
          <span className="badge badge-archived">Archived</span>
        )}
        
        {task.assignee && (
          <span className="badge badge-info">Assignee: {assigneeEmail}</span>
        )}
      </div>

      {cleanDescription && (
        <p className={`task-description ${!hasAccess ? 'desc-restricted' : ''}`}>
          {cleanDescription}
        </p>
      )}

      {task.sensitive && (
        <div className="alert alert-warning-sensitive" role="alert">
          🛡️ This task contains encrypted sensitive information (AES-256-GCM).
        </div>
      )}

      <div className="task-meta">
        <small>Created by: {sanitize(task.reporterId?.email || task.userId?.email || 'System')}</small>
        <small>{new Date(task.createdAt).toLocaleDateString()}</small>
      </div>

      <div className="task-actions">
        {/* Toggle 'done' state — Subject to Rule 3 validation rules */}
        {actions.markDone && task.status !== 'done' && (
          <button
            className="btn btn-success btn-sm"
            onClick={() => onMarkDone(task._id)}
            disabled={isProjectArchived}
            title="Mark task as completed"
            type="button"
          >
            ✓ Complete
          </button>
        )}

        {task.status === 'done' && (
          <span className="badge badge-success">Completed</span>
        )}

        {/* Edit Action — Disabled automatically if project is archived */}
        {actions.edit && !isProjectArchived && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onEdit(task._id)}
            title="Edit task parameters"
            type="button"
          >
            ✏️ Edit
          </button>
        )}

        {/* Delete Action — Controlled by project_admin rule parameters */}
        {actions.delete && (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('Are you sure you want to permanently delete this task?')) {
                onDelete(task._id);
              }
            }}
            title="Delete task entity"
            type="button"
          >
            🗑️ Delete
          </button>
        )}

        {/* Context role messages */}
        {isOnlyViewer && (
          <div className="alert alert-info-view" role="alert">
            ℹ️ Read-Only Session: Your context role restricts modifications.
          </div>
        )}

        {isProjectArchived && (
          <div className="alert alert-danger-archived" role="alert">
            ⚠️ Locked: This project is archived. Task mutations and comments are disabled.
          </div>
        )}
      </div>

      {/* Comment Section — Render configuration conditional */}
      <div className="task-comments-toggle">
        <button 
          className="btn-link-comments" 
          onClick={() => setShowComments(!showComments)}
          type="button"
        >
          {showComments ? '▲ Hide Comments' : `▼ View Comments`}
        </button>
      </div>

      {showComments && (
        <CommentSection 
          taskId={task._id} 
          isArchived={isProjectArchived} 
          user={user} 
        />
      )}
    </div>
  );
};

export default TaskCard;