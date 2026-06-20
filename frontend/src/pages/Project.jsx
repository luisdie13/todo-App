import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axios.config';
import { AuthContext } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import KanbanBoard from '../components/KanbanBoard';
import '../styles/Project.css';

function Project({ user, onLogout }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' o 'kanban'
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext); // ✅ NUEVO: Obtener authLoading del contexto
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // ✅ CRÍTICO: El useEffect ahora depende de [projectId, user, authLoading]
  // De esta forma, cuando el usuario vuelve a estar disponible tras un refresh (F5),
  // este efecto se ejecuta nuevamente y re-dispara la carga de datos
  useEffect(() => {
    // Si el estado global de autenticación todavía está cargando, o no hay usuario, espera.
    if (authLoading || !user) {
      console.log('⏳ [Project] Esperando autenticación... authLoading:', authLoading, 'user:', !!user);
      return;
    }

    loadProjectData();
  }, [projectId, user, authLoading]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      setError('');

      // Trae las tareas, detalles del proyecto y miembros en paralelo
      const [tasksRes, projectRes, membersRes] = await Promise.all([
        api.get(`/projects/${projectId}/tasks`),
        api.get(`/projects/${projectId}`), // Detalles del proyecto
        api.get(`/projects/${projectId}/members`) // Miembros de la organización
      ]);

      // Tu backend devuelve { success: true, project: {...} } para el proyecto
      if (projectRes.data && projectRes.data.project) {
        setProject(projectRes.data.project);
      } else {
        setProject({ name: 'Proyecto', _id: projectId });
      }

      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      
      // Cargar miembros de la organización
      if (membersRes.data && Array.isArray(membersRes.data.members)) {
        setMembers(membersRes.data.members);
      } else if (Array.isArray(membersRes.data)) {
        setMembers(membersRes.data);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error('Error cargando datos del proyecto:', err);
      setError('Error cargando proyecto o no tienes acceso');
      setTasks([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (data) => {
    try {
      const response = await api.post(`/projects/${projectId}/tasks`, data);
      setTasks([...tasks, response.data.task || response.data]);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        validationErrors: err.response?.data?.errors || {}
      };
    }
  };

   const handleUpdateTask = async (taskId, data) => {
     try {
       // Esto enviará un PUT a http://localhost:3000/api/tasks/ID_DE_LA_TAREA
       const response = await api.put(`/tasks/${taskId}`, data);
       // Actualizar el array local de tareas con los datos actualizados del servidor
       const updatedTask = response.data;
       setTasks(tasks.map(t => t._id === taskId ? updatedTask : t));
       return { success: true };
     } catch (err) {
       console.error('Error al actualizar tarea:', err);
       return {
         success: false,
         validationErrors: err.response?.data?.errors || {}
       };
     }
   };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    try {
      // Esto enviará un DELETE a http://localhost:3000/api/tasks/ID_DE_LA_TAREA
      await api.delete(`/tasks/${taskId}`);
      setTasks(tasks.filter(t => t._id !== taskId));
    } catch (err) {
      console.error('Error al eliminar tarea:', err);
      alert('Error al eliminar');
    }
  };

  const handleLogout = async () => {
    const { logout } = await import('../services/authService');
    await logout();
    onLogout();
    navigate('/login');
  };

  const filteredTasks = tasks.filter(task => {
    if (statusFilter && task.status !== statusFilter) return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="dashboard">
        <div className="container">
          <p className="text-muted">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="header">
        <div>
          <h1>🔒 SecureCollab</h1>
          <p>Usuario: <strong>{user?.email || 'Usuario'}</strong></p>
        </div>
        <button className="btn btn-danger" onClick={handleLogout}>
          🚪 Cerrar Sesión
        </button>
      </div>

      <div className="container">
        <div className="project-header">
          <div>
            <h2>{project?.name || 'Proyecto'}</h2>
            <p className="breadcrumb">Dashboard {'\u003e'} Proyectos {'\u003e'} Tareas</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setSelectedTask(null);
              setShowModal(true);
            }}
          >
            + Nueva tarea
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="filters-section">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
            <option value="">Estado ▼</option>
            <option value="backlog">Backlog</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>

          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="filter-select">
            <option value="">Prioridad ▼</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="tasks-table">
          <div className="table-header">
            <div className="col-title">Título</div>
            <div className="col-status">Estado</div>
            <div className="col-priority">Prioridad</div>
            <div className="col-assignee">Asignado</div>
            <div className="col-due">Vence</div>
            <div className="col-actions">Acciones</div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="table-empty">
              <p>No hay tareas aún</p>
            </div>
          ) : (
            filteredTasks.map((task, index) => (
            <div key={task._id || `task-${index}`} className="table-row">
                <div className="col-title">
                  {task.sensitive && <span className="badge-sensitive">🔒 sensitive</span>}
                  <span>{task.title}</span>
                </div>
                <div className="col-status">
                  <span className={`status-badge status-${task.status}`}>{task.status}</span>
                </div>
                <div className="col-priority">
                  <span className={`priority-dot priority-${task.priority}`}>●</span>
                  <span>{task.priority}</span>
                </div>
                <div className="col-assignee">
                  {task.assignee?.name || task.assignee?.email || 'No asignado'}
                </div>
                <div className="col-due">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                </div>
                <div className="col-actions">
                  <button 
                    className="btn-link"
                    onClick={() => {
                      setSelectedTask(task);
                      setShowModal(true);
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button 
                    className="btn-delete-action"
                    onClick={() => handleDeleteTask(task._id)}
                    title="Eliminar tarea"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <TaskModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedTask(null);
        }}
        onSubmit={selectedTask ? (data) => handleUpdateTask(selectedTask._id, data) : handleCreateTask}
        task={selectedTask}
        members={members}
      />
    </div>
  );
}

export default Project;
