import React, { useState, useEffect } from 'react';
import api from '../services/authService';

/**
 * Componente CommentSection
 * Muestra y gestiona comentarios de una tarea
 * 
 * Props:
 * - tareaId: ID de la tarea
 * - usuario: Usuario actual
 */
const CommentSection = ({ tareaId, usuario }) => {
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [editContenido, setEditContenido] = useState('');

  // Cargar comentarios al montar el componente
  useEffect(() => {
    cargarComentarios();
  }, [tareaId]);

  const cargarComentarios = async () => {
    try {
      setCargando(true);
      const response = await api.get(`/tareas/${tareaId}/comments`);
      setComentarios(response.data.comentarios || []);
      setError(null);
    } catch (err) {
      console.error('Error al cargar comentarios:', err);
      setError('Error al cargar comentarios');
    } finally {
      setCargando(false);
    }
  };

  const handleCrearComentario = async (e) => {
    e.preventDefault();
    
    if (!nuevoComentario.trim()) {
      setError('El comentario no puede estar vacío');
      return;
    }

    try {
      setCargando(true);
      await api.post(`/tareas/${tareaId}/comments`, {
        contenido: nuevoComentario.trim()
      });
      setNuevoComentario('');
      await cargarComentarios();
    } catch (err) {
      console.error('Error al crear comentario:', err);
      setError('Error al crear comentario');
    } finally {
      setCargando(false);
    }
  };

   const handleActualizarComentario = async (commentId) => {
     if (!editContenido.trim()) {
       setError('El comentario no puede estar vacío');
       return;
     }

     try {
       setCargando(true);
       await api.put(`/tareas/${tareaId}/comments/${commentId}`, {
         contenido: editContenido.trim()
       });
      setEditandoId(null);
      setEditContenido('');
      await cargarComentarios();
    } catch (err) {
      console.error('Error al actualizar comentario:', err);
      setError('Error al actualizar comentario');
    } finally {
      setCargando(false);
    }
  };

  const handleEliminarComentario = async (commentId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
      return;
    }

    try {
      setCargando(true);
      await api.delete(`/tareas/${tareaId}/comments/${commentId}`);
      await cargarComentarios();
    } catch (err) {
      console.error('Error al eliminar comentario:', err);
      setError('Error al eliminar comentario');
    } finally {
      setCargando(false);
    }
  };

  const iniciarEdicion = (comentario) => {
    setEditandoId(comentario._id);
    setEditContenido(comentario.contenido);
  };

  return (
    <div className="comment-section">
      <h4 className="comment-title">Comentarios ({comentarios.length})</h4>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button 
            className="btn-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Formulario para crear comentario */}
      <form onSubmit={handleCrearComentario} className="comment-form">
        <div className="form-group">
          <textarea
            className="form-control"
            placeholder="Escriba un comentario..."
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
            disabled={cargando}
            rows="3"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={cargando || !nuevoComentario.trim()}
        >
          {cargando ? 'Enviando...' : 'Enviar Comentario'}
        </button>
      </form>

      {/* Lista de comentarios */}
      <div className="comments-list">
        {comentarios.length === 0 ? (
          <p className="text-muted">No hay comentarios aún</p>
        ) : (
          comentarios.map((comentario) => (
            <div key={comentario._id} className="comment-item">
              <div className="comment-header">
                <strong>{comentario.usuarioId?.email || 'Usuario desconocido'}</strong>
                <small className="text-muted">
                  {new Date(comentario.createdAt).toLocaleString()}
                </small>
              </div>

              {editandoId === comentario._id ? (
                <div className="comment-edit">
                  <textarea
                    className="form-control"
                    value={editContenido}
                    onChange={(e) => setEditContenido(e.target.value)}
                    disabled={cargando}
                    rows="2"
                  />
                  <div className="comment-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleActualizarComentario(comentario._id)}
                      disabled={cargando}
                    >
                      Guardar
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditandoId(null)}
                      disabled={cargando}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="comment-content">{comentario.contenido}</p>
                  <div className="comment-actions">
                    {usuario?.id === comentario.usuarioId?._id && (
                      <>
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => iniciarEdicion(comentario)}
                          disabled={cargando}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleEliminarComentario(comentario._id)}
                          disabled={cargando}
                        >
                          🗑️ Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .comment-section {
          margin-top: 2rem;
          padding: 1rem;
          border: 1px solid #ddd;
          border-radius: 0.25rem;
          background-color: #f9f9f9;
        }

        .comment-title {
          margin-bottom: 1rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .comment-form {
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #ddd;
        }

        .comment-form .form-group {
          margin-bottom: 0.5rem;
        }

        .comment-form textarea {
          resize: vertical;
          font-family: inherit;
        }

        .comments-list {
          max-height: 500px;
          overflow-y: auto;
        }

        .comment-item {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background-color: white;
          border-left: 3px solid #007bff;
          border-radius: 0.25rem;
        }

        .comment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .comment-content {
          margin: 0.5rem 0;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .comment-edit {
          background-color: #f0f8ff;
          padding: 0.75rem;
          border-radius: 0.25rem;
          margin-bottom: 0.5rem;
        }

        .comment-edit textarea {
          margin-bottom: 0.5rem;
        }

        .comment-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .comment-actions button {
          padding: 0.25rem 0.75rem;
          font-size: 0.85rem;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #999;
          padding: 0;
          margin-left: auto;
        }

        .text-muted {
          color: #999;
          font-size: 0.9rem;
        }

        .alert {
          padding: 0.75rem;
          margin-bottom: 1rem;
          border-radius: 0.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .alert-danger {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .alert-warning {
          background-color: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        }

        .alert-info {
          background-color: #d1ecf1;
          color: #0c5460;
          border: 1px solid #bee5eb;
        }
      `}</style>
    </div>
  );
};

export default CommentSection;
