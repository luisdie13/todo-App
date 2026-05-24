import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, getProjectTasks, createTask } from '../services/projectService';
import { getUser } from '../services/tokenStorage';

const Project = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    setLoading(true);
    setError(null);

    // Obtener datos del proyecto
    const projectResult = await getProject(projectId);
    if (projectResult.success) {
      setProject(projectResult.project);
      setUserRole(projectResult.userRole);
    } else {
      setError(projectResult.error);
      setLoading(false);
      return;
    }

    // Obtener tareas del proyecto
    const tasksResult = await getProjectTasks(projectId);
    if (tasksResult.success) {
      setTasks(tasksResult.tareas);
    } else {
      setError(tasksResult.error);
    }

    setLoading(false);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTask(projectId, formData);

    if (result.success) {
      setFormData({ title: '', description: '' });
      setShowCreateForm(false);
      await fetchProjectData();
    } else {
      setError(result.error);
    }

    setSubmitting(false);
  };

  const canCreateTasks = userRole === 'project_admin' || userRole === 'developer';
  const canEditTasks = userRole === 'project_admin' || userRole === 'developer';

  if (loading) {
    return (
      <div className="project-container">
        <p>Cargando proyecto...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-container">
        <p>{error || 'Proyecto no encontrado'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="project-container">
      <div className="project-header">
        <div className="project-title">
          <h1>{project.nombre}</h1>
          <span className={`badge badge-${project.estado}`}>{project.estado}</span>
          <span className="user-role">{userRole}</span>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">
          ← Volver al Dashboard
        </button>
      </div>

      {project.descripcion && (
        <div className="project-description">
          <p>{project.descripcion}</p>
        </div>
      )}

      <div className="project-info">
        <p><strong>Creador:</strong> {project.creador.email}</p>
        <p><strong>Miembros:</strong> {project.miembros.length}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tasks-section">
        <div className="section-header">
          <h2>Tareas del Proyecto ({tasks.length})</h2>
          {canCreateTasks && (
            <button
              className="btn-primary"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancelar' : '+ Nueva Tarea'}
            </button>
          )}
        </div>

        {showCreateForm && canCreateTasks && (
          <form onSubmit={handleCreateTask} className="create-task-form">
            <input
              type="text"
              placeholder="Título de la tarea"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              minLength="3"
            />
            <textarea
              placeholder="Descripción (opcional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
            />
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creando...' : 'Crear Tarea'}
            </button>
          </form>
        )}

        {tasks.length === 0 ? (
          <p className="empty-state">
            {canCreateTasks
              ? 'No hay tareas aún. ¡Crea la primera tarea!'
              : 'No hay tareas en este proyecto'}
          </p>
        ) : (
          <div className="tasks-list">
            {tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                projectId={projectId}
                canEdit={canEditTasks}
                onUpdate={fetchProjectData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Componente de Tarjeta de Tarea
 */
const TaskCard = ({ task, projectId, canEdit, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: task.title, completed: task.completed });
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const { updateTask, deleteTask } = require('../services/projectService');

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError(null);

    const result = await updateTask(projectId, task._id, editData);

    if (result.success) {
      setIsEditing(false);
      await onUpdate();
    } else {
      setError(result.error);
    }

    setUpdating(false);
  };

  const handleDeleteTask = async () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta tarea?')) {
      const result = await deleteTask(projectId, task._id);
      if (result.success) {
        await onUpdate();
      } else {
        setError(result.error);
      }
    }
  };

  if (isEditing && canEdit) {
    return (
      <div className="task-card task-card-edit">
        <form onSubmit={handleUpdateTask}>
          <input
            type="text"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            required
            minLength="3"
          />
          <label>
            <input
              type="checkbox"
              checked={editData.completed}
              onChange={(e) => setEditData({ ...editData, completed: e.target.checked })}
            />
            Completada
          </label>
          {error && <p className="error">{error}</p>}
          <div className="task-actions">
            <button type="submit" disabled={updating} className="btn-primary">
              {updating ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditData({ title: task.title, completed: task.completed });
              }}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`task-card ${task.completed ? 'task-completed' : ''}`}>
      <div className="task-header">
        <h3 className={task.completed ? 'completed' : ''}>{task.title}</h3>
        <span className={`task-status ${task.completed ? 'completed' : 'pending'}`}>
          {task.completed ? '✓ Completada' : 'Pendiente'}
        </span>
      </div>
      <p className="task-creator">Por: {task.usuarioId.email}</p>
      <p className="task-date">
        {new Date(task.createdAt).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </p>
      {canEdit && (
        <div className="task-actions">
          <button
            onClick={() => setIsEditing(true)}
            className="btn-secondary"
          >
            ✏️ Editar
          </button>
          <button
            onClick={handleDeleteTask}
            className="btn-danger"
          >
            🗑️ Eliminar
          </button>
        </div>
      )}
    </div>
  );
};

export default Project;
