import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import api from '../config/axios.config';
import '../styles/KanbanBoard.css';

/**
 * KanbanBoard — Interactive task state management component.
 * Implements Drag and Drop while enforcing rigorous runtime ABAC protections.
 *
 * Props:
 * tasks        — Array of task entities [{ _id, title, description, sensitive, status, priority, assignee }]
 * currentUser  — Authenticated global system user object ({ _id, email, role })
 * projectRole  — Specific contextual role assigned inside this project ('project_admin' | 'developer' | 'viewer')
 * onTaskUpdate — Callback executing local state lifting to the parent dashboard view
 */
function KanbanBoard({ tasks = [], currentUser, projectRole, onTaskUpdate }) {
  const [columns, setColumns] = useState({
    backlog: [],
    in_progress: [],
    review: [],
    done: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draggedTask, setDraggedTask] = useState(null);

  const columnLabels = {
    backlog: '📋 Backlog',
    in_progress: '⚙️ In Progress',
    review: '👀 Review',
    done: '✅ Done'
  };

  // Synchronize and group incoming tasks by state categories
  useEffect(() => {
    const newColumns = {
      backlog: [],
      in_progress: [],
      review: [],
      done: []
    };

    tasks.forEach(task => {
      const status = task.status || 'backlog';
      if (newColumns[status]) {
        newColumns[status].push(task);
      }
    });

    setColumns(newColumns);
  }, [tasks]);

  // ── DOMPurify helper ───────────────────────────────────────────────────────
  const sanitize = (value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  };

  // ── ABAC evaluation context ────────────────────────────────────────────────
  /**
   * checksAccessToSensitiveDescription — Rule 6 validation logic wrapper.
   * Access is explicitly granted ONLY if:
   * 1. The user holds the contextual role of 'project_admin'
   * 2. The user is the designated current assignee of the task target
   */
  const canAccessSensitiveData = (task) => {
    if (!task.sensitive) return true;
    const isProjectAdmin = projectRole === 'project_admin';
    const taskAssigneeId = task.assigneeId || task.assignee?._id || task.assignee;
    const isAssignee = currentUser && taskAssigneeId && String(currentUser._id || currentUser.id) === String(taskAssigneeId);
    return isProjectAdmin || isAssignee;
  };

  // ── Drag & Drop handlers ───────────────────────────────────────────────────
  const handleDragStart = (e, task) => {
    // Blocks interaction visually for viewers before hitting network pipeline
    if (projectRole === 'viewer') {
      e.preventDefault();
      return;
    }
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (projectRole === 'viewer') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    if (!draggedTask || projectRole === 'viewer') return;

    if (draggedTask.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    // Rule 3: Only the assignee of a task or a project_admin can move a task to done
    if (targetStatus === 'done') {
      const taskAssigneeId = draggedTask.assigneeId || draggedTask.assignee?._id || draggedTask.assignee;
      const isAssignee = currentUser && taskAssigneeId && String(currentUser._id || currentUser.id) === String(taskAssigneeId);
      const isProjectAdmin = projectRole === 'project_admin';

      if (!isAssignee && !isProjectAdmin) {
        setError('Access Denied: Only the assignee or a project_admin can transition a task to Done.');
        setDraggedTask(null);
        return;
      }
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.patch(`/tasks/${draggedTask._id}/status`, {
        status: targetStatus
      });

      const updatedTask = response.data.task || response.data;
      
      if (onTaskUpdate) {
        onTaskUpdate(updatedTask);
      }

      // Safe mutation array copy for reactive runtime update
      const newColumns = { ...columns };
      const fromStatusArray = newColumns[draggedTask.status] || [];
      newColumns[draggedTask.status] = fromStatusArray.filter(t => t._id !== draggedTask._id);
      
      const toStatusArray = newColumns[targetStatus] || [];
      newColumns[targetStatus] = [...toStatusArray, updatedTask];
      
      setColumns(newColumns);
    } catch (err) {
      console.error('[KanbanBoard] Error updating task status:', err);
      
      // OWASP Mitigation: Strict capture of network resource limitations (429 Rate Limiting)
      if (err.response?.status === 429) {
        const retryAfter = err.response.headers['retry-after'] || '60';
        setError(`Too many execution requests. System rate limit reached. Retry-After: ${retryAfter} seconds.`);
        return;
      }

      const msg = err.response?.data?.error || 'Failed to update task transition state. Access denied.';
      setError(msg);
    } finally {
      setLoading(false);
      setDraggedTask(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  return (
    <div className="kanban-board">
      <div className="kanban-board-header">
        <h2>📊 Kanban Board</h2>
        {projectRole === 'viewer' && (
          <span className="badge-viewer-mode">⚠️ Read-Only Mode</span>
        )}
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="kanban-columns">
        {Object.entries(columns).map(([status, statusTasks]) => (
          <div
            key={status}
            className={`kanban-column k-col--${status} ${projectRole === 'viewer' ? 'col-disabled' : ''}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="column-header">
              <h3>{columnLabels[status]}</h3>
              <span className="task-count">{statusTasks.length}</span>
            </div>

            <div className="column-tasks">
              {statusTasks.length === 0 ? (
                <div className="empty-column">
                  <p>No tasks assigned</p>
                </div>
              ) : (
                statusTasks.map((task) => {
                  const hasAccessToDescription = canAccessSensitiveData(task);
                  const cleanTitle = sanitize(task.title);
                  
                  // Enforces encryption masking at rest for unauthorized context roles
                  const rawDescription = hasAccessToDescription 
                    ? (task.description || '') 
                    : '🔒 [RESTRICTED CONTENT] — Unauthorized Context Role';
                  
                  const cleanDescription = sanitize(rawDescription);

                  return (
                    <div
                      key={task._id}
                      className={`kanban-card card-priority-${task.priority} ${
                        draggedTask?._id === task._id ? 'dragging' : ''
                      } ${task.sensitive ? 'k-card--sensitive' : ''}`}
                      draggable={projectRole !== 'viewer'}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="card-header">
                        {task.sensitive && (
                          <span className="badge-sensitive" title="Encrypted Sensitive Content">
                            🔒 Sensitive
                          </span>
                        )}
                        <h4>{cleanTitle}</h4>
                      </div>

                      {cleanDescription && (
                        <p className={`card-description ${!hasAccessToDescription ? 'desc-masked' : ''}`}>
                          {cleanDescription.substring(0, 80)}
                          {cleanDescription.length > 80 ? '...' : ''}
                        </p>
                      )}

                      <div className="card-footer">
                        <div className="card-meta">
                          <span className={`priority-dot priority-${task.priority}`}>●</span>
                          <span className="priority-text">{sanitize(task.priority)}</span>
                        </div>
                        
                        {task.dueDate && (
                          <span className="due-date">
                            📅 {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {task.assignee && (
                        <div className="card-assignee">
                          👤 {sanitize(task.assignee.name || task.assignee.email)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="loading-overlay">Updating task state registry…</div>}
    </div>
  );
}

export default KanbanBoard;