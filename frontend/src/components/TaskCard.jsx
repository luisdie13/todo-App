import React from 'react';
import {
  canEditTask,
  canDeleteTask,
  canMarkDone,
  isViewer,
  getTaskActions
} from '../utils/permissions';

/**
 * Componente TaskCard
 * Muestra una tarea con botones de acción basados en permisos ABAC
 * 
 * Props:
 * - tarea: Objeto de tarea
 * - usuario: Usuario actual
 * - membership: Membresía del usuario en el proyecto
 * - proyecto: Proyecto actual
 * - onEdit: Callback para editar
 * - onDelete: Callback para eliminar
 * - onMarkDone: Callback para marcar como completada
 */
const TaskCard = ({
  tarea,
  usuario,
  membership,
  proyecto,
  onEdit,
  onDelete,
  onMarkDone
}) => {
  // Obtener permisos para esta tarea
  const actions = getTaskActions(usuario, tarea, membership, proyecto);
  
  // Determinar si el usuario es solo viewer
  const soloViewer = isViewer(membership);

  // Si no tiene permiso para leer, no mostrar
  if (!actions.read) {
    return null;
  }

  return (
    <div className={`task-card ${tarea.completed ? 'completed' : ''} ${proyecto?.estado === 'archivado' ? 'archived' : ''}`}>
      <div className="task-header">
        <h3 className="task-title">{tarea.title}</h3>
        {proyecto?.estado === 'archivado' && (
          <span className="badge badge-archived">Archivado</span>
        )}
        {tarea.assignee && (
          <span className="badge badge-info">Asignado a: {tarea.assignee.email}</span>
        )}
      </div>

      {tarea.description && (
        <p className="task-description">{tarea.description}</p>
      )}

      {tarea.sensitive && (
        <div className="alert alert-warning">
          ⚠️ Esta tarea contiene información sensible (cifrada)
        </div>
      )}

      <div className="task-meta">
        <small>Creado por: {tarea.usuarioId?.email || 'Usuario desconocido'}</small>
        <small>{new Date(tarea.createdAt).toLocaleDateString()}</small>
      </div>

      <div className="task-actions">
        {/* Botón para marcar como completada */}
        {actions.markDone && !tarea.completed && (
          <button
            className="btn btn-success btn-sm"
            onClick={() => onMarkDone(tarea._id)}
            title="Marcar como completada"
          >
            ✓ Completar
          </button>
        )}

        {/* Mostrar estado completado */}
        {tarea.completed && (
          <span className="badge badge-success">Completada</span>
        )}

        {/* Botón para editar */}
        {actions.edit && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onEdit(tarea._id)}
            title="Editar tarea"
          >
            ✏️ Editar
          </button>
        )}

        {/* Botón para eliminar */}
        {actions.delete && (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('¿Estás seguro de que deseas eliminar esta tarea?')) {
                onDelete(tarea._id);
              }
            }}
            title="Eliminar tarea"
          >
            🗑️ Eliminar
          </button>
        )}

        {/* Mensaje para viewers */}
        {soloViewer && (
          <div className="alert alert-info">
            ℹ️ Tienes acceso de lectura. No puedes editar esta tarea.
          </div>
        )}

        {/* Advertencia para proyecto archivado */}
        {proyecto?.estado === 'archivado' && (
          <div className="alert alert-warning">
            ⚠️ Este proyecto está archivado. No puedes realizar cambios.
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
