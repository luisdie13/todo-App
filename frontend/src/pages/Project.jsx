import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../config/axios.config';
import { AuthContext } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import { canViewSensitiveContent, canCreateTask, isViewer } from '../utils/permissions';
import '../styles/Project.css';

// ── Rate-limit banner component ──────────────────────────────────────────────
function RateLimitBanner({ retryAfter, onDismiss }) {
  const [remaining, setRemaining] = useState(retryAfter);

  useEffect(() => {
    if (remaining <= 0) {
      onDismiss();
      return;
    }
    const timer = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) { clearInterval(timer); onDismiss(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining, onDismiss]);

  return (
    <div className="alert alert-rate-limit" role="alert">
      <span>⏳</span>
      <strong>Too many execution requests.</strong> System rate limit reached. Please wait{' '}
      <span className="rate-limit-counter">{remaining}s</span> before retrying.
      <button className="rate-limit-dismiss" onClick={onDismiss} aria-label="Dismiss alert">✕</button>
    </div>
  );
}

// ── Sensitive content cell (Rule 6 ABAC Mitigation) ──────────────────────────
function SensitiveDescription({ task, user, userMembership }) {
  const allowed = canViewSensitiveContent(user, task, userMembership);

  const sanitizeText = (value) => {
    if (!value) return '—';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  };

  if (!task.sensitive) {
    return <span className="task-description-text">{sanitizeText(task.description)}</span>;
  }

  if (!allowed) {
    return (
      <span className="restricted-content" title="Access Denied: Enforced cryptographic boundaries restrict reading rights.">
        🔒 Restricted Content — Unauthorized Role
      </span>
    );
  }

  return (
    <span className="task-description-text sensitive-visible">
      🔓 {sanitizeText(task.description)}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
function Project({ user, onLogout }) {
  const { projectId }          = useParams();
  const navigate               = useNavigate();
  const { authLoading }        = useContext(AuthContext);

  const [project, setProject]           = useState(null);
  const [tasks, setTasks]               = useState([]);
  const [members, setMembers]           = useState([]);
  const [userMembership, setUserMembership] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  const sanitize = useCallback((value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  }, []);

  const resolveUserMembership = useCallback((memberList, currentUser) => {
    if (!currentUser || !Array.isArray(memberList)) return null;
    return memberList.find((m) => {
      const memberId = m.userId?._id || m.userId;
      return String(memberId) === String(currentUser.id || currentUser._id);
    }) ?? null;
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    loadProjectData();
  }, [projectId, user, authLoading]);

  const handleApiError = useCallback((err) => {
    if (err.response?.status === 429) {
      const retryAfter = parseInt(
        err.response.headers['retry-after'] ||
        err.response.data?.retryAfter ||
        '30',
        10
      );
      setRateLimitSeconds(retryAfter);
      return;
    }
    const message = err.response?.data?.error || err.message || 'An unexpected cryptographic verification error occurred';
    setError(sanitize(message));
  }, [sanitize]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError('');

      // Enforce authorization validation parameters securely
      const projectRes = await api.get(`/projects/${projectId}`);
      const projectData = projectRes.data?.project ?? projectRes.data;

      if (!projectData) {
        setError('Project perimeter target registry records not found.');
        return;
      }

      // Execute subsequent queries only after parsing parent organization verification layer
      const [tasksRes, membersRes] = await Promise.all([
        api.get(`/projects/${projectId}/tasks`),
        api.get(`/projects/${projectId}/members`)
      ]);

      setProject(projectData);
      setTasks(Array.isArray(tasksRes.data?.tasks) ? tasksRes.data.tasks : Array.isArray(tasksRes.data) ? tasksRes.data : []);

      const memberList = membersRes.data?.members ?? (Array.isArray(membersRes.data) ? membersRes.data : []);
      setMembers(memberList);

      const resolvedMembership = resolveUserMembership(memberList, user);
      setUserMembership(resolvedMembership);

    } catch (err) {
      console.error('[Project] Secure bootstrap operation failure:', err);
      if (err.response?.status === 403) {
        // Enforces strict cross-origin redirection borders (Rule 1 / IDOR mitigation)
        navigate('/dashboard', { replace: true });
        return;
      }
      handleApiError(err);
      setTasks([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (data) => {
    try {
      const response = await api.post(`/projects/${projectId}/tasks`, data);
      const newTask  = response.data.task ?? response.data;
      setTasks((prev) => [...prev, newTask]);
      return { success: true };
    } catch (err) {
      if (err.response?.status === 429) handleApiError(err);
      return {
        success: false,
        error:   err.response?.data?.error || err.message,
        validationErrors: err.response?.data?.errors ?? {}
      };
    }
  };

  const handleUpdateTask = async (taskId, data) => {
    try {
      const response   = await api.put(`/tasks/${taskId}`, data);
      const updatedTask = response.data.task ?? response.data;
      setTasks((prev) => prev.map((t) => (t._id === taskId ? updatedTask : t)));
      return { success: true };
    } catch (err) {
      if (err.response?.status === 429) handleApiError(err);
      return {
        success: false,
        error: err.response?.data?.error || err.message,
        validationErrors: err.response?.data?.errors ?? {}
      };
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('CRITICAL GOVERNANCE: Are you absolutely sure you want to permanently delete this task? This action cannot be rolled back.')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleLogout = async () => {
    const { logout } = await import('../services/authService');
    await logout();
    onLogout();
    navigate('/login');
  };

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter   && task.status   !== statusFilter)   return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    return true;
  });

  const viewerMode = isViewer(userMembership);
  const isProjectArchived = project?.status === 'archived'; // Rule 4 Field alignment checking

  if (loading) {
    return (
      <div className="dashboard">
        <div className="container" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="text-muted">Loading secure project parameters perimeter…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* ── Navbar header ────────────────────────────────────────────────── */}
      <div className="header">
        <div>
          <h1>🔒 SecureCollab Workspace</h1>
          <p>Session Identity: <strong>{sanitize(user?.email)}</strong></p>
        </div>
        <button className="btn btn-danger" onClick={handleLogout} type="button">
          {"🚪 Logout"}
        </button>
      </div>

      <div className="container">
        {/* ── Rate limit mitigation card ─────────────────────────────────── */}
        {rateLimitSeconds > 0 && (
          <RateLimitBanner
            retryAfter={rateLimitSeconds}
            onDismiss={() => setRateLimitSeconds(0)}
          />
        )}

        {/* ── Project core header ────────────────────────────────────────── */}
        <div className="project-header">
          <div>
            <h2>📁 Project: {sanitize(project?.name)}</h2>
            <p className="breadcrumb">Dashboard › Organizations › Project Context Pipelines</p>
            {userMembership && (
              <span className={`membership-badge membership-badge--${sanitize(userMembership.role)}`}>
                Context Role Assigned: <strong>{sanitize(userMembership.role).toUpperCase().replace('_', ' ')}</strong>
              </span>
            )}
          </div>
          
          {/* Rule 4 & Rule 2: Blocks rendering task actions if viewer or if target path is locked */}
          {!viewerMode && !isProjectArchived && (
            <button
              className="btn btn-primary"
              onClick={() => { setSelectedTask(null); setShowModal(true); }}
              type="button"
            >
              ➕ New Task
            </button>
          )}
        </div>

        {/* ── Rule 2 / Rule 4 Banner Alerts Enforcements ─────────────────── */}
        {viewerMode && (
          <div className="alert alert-info viewer-notice" role="alert">
            ℹ️ <strong>Read-Only Permission Session:</strong> Operational task modifications and additions are fully restricted.
          </div>
        )}

        {isProjectArchived && (
          <div className="alert alert-danger archived-notice" role="alert">
            ⚠️ <strong>Locked Boundary Perimeter:</strong> This project registry is fully archived. Enforced ABAC governance policies restrict edits, completions, and commentary changes.
          </div>
        )}

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {/* ── Query Parameter Filters ────────────────────────────────────── */}
        <div className="filters-section">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter tasks dynamically by state status parameters"
          >
            <option value="">Status Parameter ▼</option>
            <option value="backlog">Backlog</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter tasks dynamically by security urgency priority metrics"
          >
            <option value="">Priority Metric ▼</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* ── Grid/Table Data Display Layout (OWASP Protected Nodes) ──────── */}
        <div className="tasks-table">
          <div className="table-header">
            <div className="col-title">Title</div>
            <div className="col-description">Description Matrix</div>
            <div className="col-status">Status Flag</div>
            <div className="col-priority">Priority Dot</div>
            <div className="col-assignee">Assigned Operator</div>
            <div className="col-due">Due Date</div>
            {!viewerMode && !isProjectArchived && <div className="col-actions">Actions</div>}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="table-empty">
              <p>No operational task payloads located inside this target workspace boundary.</p>
            </div>
          ) : (
            filteredTasks.map((task, index) => {
              const cleanTitle = sanitize(task.title);
              const cleanStatus = sanitize(task.status || 'backlog');
              const cleanPriority = sanitize(task.priority || 'medium');
              const cleanAssignee = sanitize(task.assignee?.name || task.assignee?.email || 'Unassigned Workspace Asset');
              const taskKeyId = task._id || `task-row-index-${index}`;

              return (
                <div key={taskKeyId} className={`table-row ${task.sensitive ? 'row-sensitive' : ''}`}>
                  
                  {/* Title + Sensitive Indicator Flag (Rule 6 UI Tracker) */}
                  <div className="col-title">
                    {task.sensitive && (
                      <span className="badge-sensitive" title="Cryptographic Shield Active: Data Payload encrypted at rest.">
                        🔴 SENSITIVE
                      </span>
                    )}
                    <strong>{cleanTitle}</strong>
                  </div>

                  {/* Description Box — Monitored under Rule 6 permission check context */}
                  <div className="col-description">
                    <SensitiveDescription
                      task={task}
                      user={user}
                      userMembership={userMembership}
                    />
                  </div>

                  {/* Status Flag */}
                  <div className="col-status">
                    <span className={`status-badge status-${cleanStatus}`}>
                      {cleanStatus.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>

                  {/* Priority Dot */}
                  <div className="col-priority">
                    <span className={`priority-dot priority-${cleanPriority}`}>●</span>
                    <span style={{ textTransform: 'capitalize' }}>{cleanPriority}</span>
                  </div>

                  {/* Operator Assignee Metadata */}
                  <div className="col-assignee">
                    {cleanAssignee}
                  </div>

                  {/* Expiration Due Date Node */}
                  <div className="col-due">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                  </div>

                  {/* Context Actions Row Panels — Structural lock active if archived */}
                  {!viewerMode && !isProjectArchived && (
                    <div className="col-actions">
                      <button
                        className="btn-link"
                        onClick={() => { setSelectedTask(task); setShowModal(true); }}
                        aria-label={`Edit metadata specs for task payload named ${cleanTitle}`}
                        type="button"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn-delete-action"
                        onClick={() => handleDeleteTask(task._id)}
                        aria-label={`Purge task data payload record for entity named ${cleanTitle}`}
                        type="button"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Task modification popup core modal layer ─────────────────── */}
      {!viewerMode && (
        <TaskModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setSelectedTask(null); }}
          onSubmit={
            selectedTask
              ? (data) => handleUpdateTask(selectedTask._id, data)
              : handleCreateTask
          }
          task={selectedTask}
          members={members}
          project={project}
        />
      )}
    </div>
  );
}

export default Project;