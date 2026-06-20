import React, { useState, useEffect } from 'react';
import api from '../config/axios.config';
import '../styles/KanbanBoard.css';

function KanbanBoard({ tasks = [], onTaskUpdate, members = [] }) {
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

  // Reorganizar tareas por estado
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

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();

    if (!draggedTask) return;

    // Si se suelta en el mismo estado, no hacer nada
    if (draggedTask.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Hacer petición PATCH al backend
      const response = await api.patch(`/tasks/${draggedTask._id}/status`, {
        status: targetStatus
      });

      // Actualizar tarea localmente
      const updatedTask = response.data;
      
      // Notificar al componente padre
      if (onTaskUpdate) {
        onTaskUpdate(updatedTask);
      }

      // Actualizar columnas localmente para feedback inmediato
      const newColumns = { ...columns };
      
      // Remover de la columna anterior
      const fromStatusArray = newColumns[draggedTask.status] || [];
      newColumns[draggedTask.status] = fromStatusArray.filter(t => t._id !== draggedTask._id);
      
      // Agregar a la nueva columna
      const toStatusArray = newColumns[targetStatus] || [];
      newColumns[targetStatus] = [...toStatusArray, updatedTask];
      
      setColumns(newColumns);
    } catch (err) {
      console.error('Error al actualizar estado de tarea:', err);
      setError('Error al mover tarea. Intenta de nuevo.');
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
      <h2>📊 Tablero Kanban</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="kanban-columns">
        {Object.entries(columns).map(([status, statusTasks]) => (
          <div
            key={status}
            className="kanban-column"
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
                  <p>Sin tareas</p>
                </div>
              ) : (
                statusTasks.map((task) => (
                  <div
                    key={task._id}
                    className={`kanban-card ${draggedTask?._id === task._id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="card-header">
                      {task.sensitive && <span className="badge-sensitive">🔒</span>}
                      <h4>{task.title}</h4>
                    </div>

                    {task.description && (
                      <p className="card-description">
                        {task.description.substring(0, 80)}
                        {task.description.length > 80 ? '...' : ''}
                      </p>
                    )}

                    <div className="card-footer">
                      <div className="card-meta">
                        <span className={`priority-dot priority-${task.priority}`}>●</span>
                        <span className="priority-text">{task.priority}</span>
                      </div>
                      
                      {task.dueDate && (
                        <span className="due-date">
                          📅 {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {task.assignee && (
                      <div className="card-assignee">
                        👤 {task.assignee.name || task.assignee.email}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="loading-overlay">Actualizando...</div>}
    </div>
  );
}

export default KanbanBoard;
