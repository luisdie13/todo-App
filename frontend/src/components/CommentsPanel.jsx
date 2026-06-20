import React, { useState, useEffect } from 'react';
import api from '../config/axios.config';
import DOMPurify from 'dompurify';

function CommentsPanel({ taskId, isOpen = false }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && taskId) {
      loadComments();
    }
  }, [taskId, isOpen]);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/tareas/${taskId}/comments`);
      setComments(Array.isArray(response.data.comentarios) ? response.data.comentarios : []);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
      setError('Error al cargar comentarios');
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim()) {
      setError('El comentario no puede estar vacío');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Sanitizar el comentario antes de enviar
      const sanitizedComment = DOMPurify.sanitize(newComment);

      const response = await api.post(`/tareas/${taskId}/comments`, {
        contenido: sanitizedComment
      });

      // Agregar el nuevo comentario a la lista
      setComments([...comments, response.data.comentario || response.data]);
      setNewComment('');
    } catch (err) {
      console.error('Error al agregar comentario:', err);
      setError(err.response?.data?.error || 'Error al agregar comentario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('¿Eliminar este comentario?')) return;

    try {
      await api.delete(`/tareas/${taskId}/comments/${commentId}`);
      setComments(comments.filter(c => c._id !== commentId));
    } catch (err) {
      console.error('Error al eliminar comentario:', err);
      setError('Error al eliminar comentario');
    }
  };

  return (
    <div className="comments-panel">
      <h3>💬 Comentarios</h3>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="comments-list">
        {loading && comments.length === 0 ? (
          <p className="text-muted">Cargando comentarios...</p>
        ) : comments.length === 0 ? (
          <p className="text-muted">Sin comentarios aún</p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="comment-item">
              <div className="comment-header">
                <strong>{comment.usuarioId?.email || 'Usuario'}</strong>
                <span className="comment-date">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="comment-content">
                {comment.content}
              </div>
              <div className="comment-actions">
                <button
                  className="btn-link btn-danger btn-sm"
                  onClick={() => handleDeleteComment(comment._id)}
                  disabled={loading}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleAddComment} className="comment-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribir un comentario..."
          rows={3}
          disabled={loading}
          className="comment-input"
        />
        <button 
          type="submit" 
          className="btn btn-primary btn-sm"
          disabled={loading || !newComment.trim()}
        >
          {loading ? 'Enviando...' : '📝 Comentar'}
        </button>
      </form>
    </div>
  );
}

export default CommentsPanel;
