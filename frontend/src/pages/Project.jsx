import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../config/axios.config';
import { AuthContext } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import { canViewSensitiveContent, isViewer } from '../utils/permissions';
import '../styles/Project.css';

// ── Componente para contenido sensible ───────────────────────────────────────
function SensitiveDescription({ task, user, userMembership }) {
  const allowed = canViewSensitiveContent(user, task, userMembership);
  const sanitizeText = (val) => val ? DOMPurify.sanitize(String(val), { ALLOWED_TAGS: [] }).trim() : '—';

  if (!task.sensitive) return <span>{sanitizeText(task.description)}</span>;
  if (!allowed) return <span className="restricted-content">🔒 Restricted Content</span>;
  return <span className="sensitive-visible">🔓 {sanitizeText(task.description)}</span>;
}

// ── Componente principal ─────────────────────────────────────────────────────
function Project({ user, onLogout }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [userMembership, setUserMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const sanitize = (val) => val ? DOMPurify.sanitize(String(val), { ALLOWED_TAGS: [] }).trim() : '';

  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError('');

      const [projectRes, tasksRes, membersRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/tasks`),
        api.get(`/projects/${projectId}/members`)
      ]);

      setProject(projectRes.data?.project ?? projectRes.data);
      setTasks(tasksRes.data?.tasks || []);
      const memberList = membersRes.data?.members || [];
      setMembers(memberList);
      
      const membership = memberList.find(m => String(m.userId) === String(user?._id));
      setUserMembership(membership || null);
    } catch (err) {
      if (err.response?.status === 403) navigate('/dashboard', { replace: true });
      else setError(err.response?.data?.error || 'Failed to load project perimeter.');
    } finally {
      setLoading(false);
    }
  }, [projectId, user, navigate]);

  useEffect(() => {
    if (!authLoading && user && projectId) loadProjectData();
  }, [authLoading, user, projectId, loadProjectData]);

  const handleCreateTask = async (data) => {
    try {
      const res = await api.post(`/projects/${projectId}/tasks`, data);
      // Garantizar que usamos el objeto que retorna la DB
      const savedTask = res.data.task ?? res.data;
      setTasks(prev => [...prev, savedTask]);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const handleUpdateTask = async (taskId, data) => {
    try {
      const res = await api.put(`/tasks/${taskId}`, data);
      const updatedTask = res.data.task ?? res.data;
      setTasks(prev => prev.map(t => t._id === taskId ? updatedTask : t));
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) { setError('Failed to delete task.'); }
  };

  if (loading) return <div className="dashboard">Loading workspace boundary...</div>;

  return (
    <div className="dashboard">
      <div className="header">
        <h1>🔒 SecureCollab Workspace</h1>
        <button className="btn btn-danger" onClick={onLogout}>🚪 Logout</button>
      </div>

      <div className="container">
        {error && <div className="alert alert-danger">{error}</div>}
        
        <div className="project-header">
          <h2>📁 Project: {sanitize(project?.name)}</h2>
          {!isViewer(userMembership) && project?.status !== 'archived' && (
            <button className="btn btn-primary" onClick={() => { setSelectedTask(null); setShowModal(true); }}>
              ➕ New Task
            </button>
          )}
        </div>

        <div className="tasks-table">
          {tasks.map(task => (
            <div key={task._id} className="table-row">
              <div className="col-title"><strong>{sanitize(task.title)}</strong></div>
              <div className="col-description">
                <SensitiveDescription task={task} user={user} userMembership={userMembership} />
              </div>
              <div className="col-actions">
                <button className="btn-link" onClick={() => { setSelectedTask(task); setShowModal(true); }}>✏️ Edit</button>
                <button className="btn-delete-action" onClick={() => handleDeleteTask(task._id)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <TaskModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={selectedTask ? (d) => handleUpdateTask(selectedTask._id, d) : handleCreateTask}
          task={selectedTask}
          members={members}
        />
      )}
    </div>
  );
}

export default Project;