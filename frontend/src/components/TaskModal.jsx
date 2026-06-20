import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import CommentsPanel from './CommentsPanel';

// Modal para crear/editar tareas
// Campos: Título, Descripción, Prioridad, Estado, Asignado, Vence, Sensitive toggle
// DOMPurify sanitiza inputs antes del POST/PUT
// Validación 422: campos en rojo si error

function TaskModal({ isOpen, onClose, onSubmit, task = null, members = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('backlog');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setStatus(task.status || 'backlog');
      // Soporta assignee poblado o assigneeId como fallback
      setAssigneeId(task.assignee?._id || task.assignee || task.assigneeId?._id || task.assigneeId || '');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setSensitive(task.sensitive || false);
    } else {
      // Reset cuando no hay tarea (nuevo)
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('backlog');
      setAssigneeId('');
      setDueDate('');
      setSensitive(false);
    }
  }, [task, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    // DOMPurify sanitiza antes de enviar
    const sanitizedTitle = DOMPurify.sanitize(title);
    const sanitizedDescription = DOMPurify.sanitize(description);

    const data = {
      title: sanitizedTitle,
      description: sanitizedDescription,
      priority,
      status,
      assigneeId,
      dueDate,
      sensitive
    };

    const result = await onSubmit(data);
    setLoading(false);

    if (result.success) {
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('backlog');
      setAssigneeId('');
      setDueDate('');
      setSensitive(false);
    } else if (result.validationErrors) {
      setErrors(result.validationErrors);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{task ? 'Editar tarea' : 'Nueva tarea'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumen de la tarea"
              required
              disabled={loading}
              className={errors.title ? 'input-error' : ''}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de la tarea..."
              disabled={loading}
              rows={4}
              className={errors.description ? 'input-error' : ''}
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Prioridad</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={loading}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="form-group">
              <label>Estado</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={loading}>
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="form-row">
           <div className="form-group">
             <label>Asignado a</label>
             <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={loading}>
               <option value="">Seleccionar...</option>
               {members && members.length > 0 ? (
                 members.map(m => (
                   <option key={m._id || m.id} value={m._id || m.id}>
                     {m.email}
                   </option>
                 ))
               ) : (
                 <option disabled>No hay miembros disponibles</option>
               )}
             </select>
           </div>

            <div className="form-group">
              <label>Vence</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={sensitive}
                onChange={(e) => setSensitive(e.target.checked)}
                disabled={loading}
              />
              <span>Tarea sensitive (cifrado AES-256-GCM)</span>
            </label>
          </div>

          {sensitive && (
            <div className="alert alert-warning">
              🔒 La descripción se cifrará en la BD. Solo el assignee y project_admin podrán leerla.
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>

        {/* Panel de comentarios - Solo visible si se está editando una tarea existente */}
        {task && (
          <div className="modal-divider">
            <CommentsPanel taskId={task._id} isOpen={isOpen} />
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskModal;
