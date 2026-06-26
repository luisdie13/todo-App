import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import CommentsPanel from './CommentsPanel';

/**
 * TaskModal — Modal component for task creation and mutation updates.
 * Integrates contextual locking if the parent project metadata is archived.
 * Enforces dynamic exclusion filtering over read-only 'viewer' accounts.
 *
 * Props:
 * - isOpen: Boolean status flag managing modal visibility layout
 * - onClose: Callback executing state reset and modal closure
 * - onSubmit: Promise wrapper routing form payloads to the network database
 * - task: Target task entity for edit context mode (null implies creation)
 * - members: Array of project users [{ _id, email, role }] for selection routing
 * - project: Parent project object containing state configuration flags
 */
function TaskModal({ isOpen, onClose, onSubmit, task = null, members = [], project = null }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('backlog');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Rule 4 validation: Projects with status 'archived' lock data modifications
  const isProjectArchived = project?.status === 'archived';

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setStatus(task.status || 'backlog');
      setAssigneeId(task.assignee?._id || task.assignee || task.assigneeId?._id || task.assigneeId || '');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setSensitive(task.sensitive || false);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('backlog');
      setAssigneeId('');
      setDueDate('');
      setSensitive(false);
    }
    setErrors({});
  }, [task, isOpen]);

  // ── DOMPurify Strict Plain Text Helper ────────────────────────────────────
  const sanitizeInput = (value) => {
    return DOMPurify.sanitize(String(value), { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    }).trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isProjectArchived || loading) return;

    setErrors({});
    setLoading(true);

    const sanitizedTitle = sanitizeInput(title);
    const sanitizedDescription = sanitizeInput(description);

    if (!sanitizedTitle) {
      setErrors({ title: 'Title is required and must contain valid characters.' });
      setLoading(false);
      return;
    }

    const data = {
      title: sanitizedTitle,
      description: sanitizedDescription,
      priority,
      status,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      sensitive
    };

    const result = await onSubmit(data);
    setLoading(false);

    if (result?.success) {
      onClose();
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('backlog');
      setAssigneeId('');
      setDueDate('');
      setSensitive(false);
    } else if (result?.validationErrors) {
      setErrors(result.validationErrors);
    } else if (result?.error) {
      setErrors({ global: result.error });
    }
  };

  if (!isOpen) return null;

  // Dynamic RBAC Filter: Extract and retain active task execution roles, dropping read-only 'viewer' accounts
  const assignableMembers = Array.isArray(members) 
    ? members.filter(m => m && m.role !== 'viewer') 
    : [];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="modal-title">{task ? 'Edit Task Specification' : 'Create New Task'}</h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close modal">✕</button>
        </div>

        {isProjectArchived && (
          <div className="alert alert-danger" role="alert">
            ⚠️ Locked: This project is archived. Enforced governance rules restrict modifications.
          </div>
        )}

        {errors.global && (
          <div className="alert alert-danger" role="alert">
            {errors.global}
          </div>
        )}

        <form onSubmit={handleSubmit} className="task-form">
          <div className="form-group">
            <label htmlFor="task-title">Title *</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task summary title"
              required
              disabled={loading || isProjectArchived}
              className={errors.title ? 'input-error' : ''}
              autoComplete="off"
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="task-desc">Description</label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed task description parameters…"
              disabled={loading || isProjectArchived}
              rows={4}
              className={errors.description ? 'input-error' : ''}
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task-priority">Priority</label>
              <select 
                id="task-priority" 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)} 
                disabled={loading || isProjectArchived}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="task-status">Status Registry</label>
              <select 
                id="task-status" 
                value={status} 
                onChange={(e) => setStatus(e.target.value)} 
                disabled={loading || isProjectArchived}
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="task-assignee">Assignee Target</label>
              <select 
                id="task-assignee" 
                value={assigneeId} 
                onChange={(e) => setAssigneeId(e.target.value)} 
                disabled={loading || isProjectArchived}
              >
                <option value="">Select operational team member…</option>
                {assignableMembers.length > 0 ? (
                  assignableMembers.map(m => {
                    const memberId = m._id || m.id;
                    const cleanEmail = DOMPurify.sanitize(String(m.email || ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
                    const cleanRole = DOMPurify.sanitize(String(m.role || 'developer'), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).toUpperCase().replace('_', ' ');
                    
                    return (
                      <option key={memberId} value={memberId}>
                        {cleanEmail} ({cleanRole})
                      </option>
                    );
                  })
                ) : (
                  <option disabled>No assignable context roles active</option>
                )}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="task-date">Due Date</label>
              <input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading || isProjectArchived}
              />
            </div>
          </div>

          <div className="form-group checkbox">
            <label htmlFor="task-sensitive-toggle">
              <input
                id="task-sensitive-toggle"
                type="checkbox"
                checked={sensitive}
                onChange={(e) => setSensitive(e.target.checked)}
                disabled={loading || isProjectArchived || !!task} 
              />
              <span>Mark as sensitive item (AES-256-GCM Encryption)</span>
            </label>
          </div>

          {sensitive && (
            <div className="alert alert-warning-crypt" role="alert">
              🔒 Security Enforcement: The metadata payload details will be fully encrypted at rest in MongoDB. Reading rights are strictly limited to the assignee and authorized administrative contextual roles.
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || isProjectArchived}>
              {loading ? 'Processing…' : 'Save Specifications'}
            </button>
          </div>
        </form>

        {task && (
          <div className="modal-divider">
            <CommentsPanel taskId={task._id} isOpen={isOpen} isLocked={isProjectArchived} />
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskModal;