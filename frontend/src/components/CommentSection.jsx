import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import api from '../config/axios.config';

/**
 * CommentSection Component — Core task commentary manager for SecureCollab.
 * Enforces security guidelines:
 * - Sanitizes user text via DOMPurify plain text configuration (OWASP XSS Mitigation).
 * - Implements dynamic UI count down states for Class 9 Rate Limiting (20 comments/min).
 * - Enforces Rule 4 criteria by locking operations if isArchived resolves to true.
 *
 * Props:
 * - taskId     : Target database reference ID for the parent task entity
 * - currentUser: Authenticated user object containing identity properties
 * - isArchived : Boolean flag inheriting the frozen parent project status
 */
const CommentSection = ({ taskId, currentUser, isArchived = false }) => {
  const [comments, setComments]       = useState([]);
  const [newComment, setNewComment]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [editContent, setEditContent] = useState('');
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // ── DOMPurify Strict Plain Text Helper ────────────────────────────────────
  const sanitize = useCallback((value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  }, []);

  // Sync and fetch records from correct English REST route context (Class 10)
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tasks/${taskId}/comments`);
      
      // Parse payload structure mapping cleanly from backend collection array schema
      const commentData = response.data?.comments || response.data?.comentarios || response.data || [];
      setComments(Array.isArray(commentData) ? commentData : []);
      setError(null);
    } catch (err) {
      console.error('[CommentSection] Error loading associated task commentary registries:', err);
      setError('Failed to retrieve secure commentary feeds.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (taskId) {
      loadComments();
    }
  }, [taskId, loadComments]);

  // Live interval thread handling rate limit delays (HTTP 429)
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    
    const countdown = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(countdown);
  }, [rateLimitSeconds]);

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (isArchived || loading || rateLimitSeconds > 0) return;
    
    const cleanComment = sanitize(newComment);

    if (!cleanComment) {
      setError('Comment payload parameters cannot be empty or clean blanks.');
      return;
    }

    try {
      setLoading(true);
      // Compliance: binds fields strictly to structural db model schema definitions ('body')
      await api.post(`/tasks/${taskId}/comments`, {
        body: cleanComment
      });
      setNewComment('');
      await loadComments();
    } catch (err) {
      console.error('[CommentSection] Failed to create comment payload record:', err);
      
      if (err.response?.status === 429) {
        const retryAfterValue = parseInt(err.response.headers['retry-after'] || '60', 10);
        setRateLimitSeconds(retryAfterValue);
        setError('Comment submission frequency threshold triggered.');
        return;
      }

      setError(err.response?.data?.error || 'Failed to dispatch commentary entry.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateComment = async (commentId) => {
    if (isArchived) return;
    
    const cleanEdit = sanitize(editContent);

    if (!cleanEdit) {
      setError('Updated specifications body text cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/comments/${commentId}`, {
        body: cleanEdit
      });
      setEditingId(null);
      setEditContent('');
      await loadComments();
    } catch (err) {
      console.error('[CommentSection] Mutation request aborted by server context:', err);
      setError(err.response?.data?.error || 'Failed to apply comment adjustments.');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarComentario = async (commentId) => {
    if (isArchived) return;
    if (!window.confirm('Are you sure you want to permanently erase this comment record from memory?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/comments/${commentId}`);
      await loadComments();
    } catch (err) {
      console.error('[CommentSection] Destruction request rejected:', err);
      setError(err.response?.data?.error || 'Access Denied: You do not hold ownership parameters.');
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicion = (comentario) => {
    if (isArchived) return;
    setEditingId(comentario._id);
    setEditContent(comentario.body || comentario.contenido || '');
  };

  const currentUserId = currentUser?.id || currentUser?._id;

  return (
    <div className="comment-section">
      <h4 className="comment-title">💬 Task Commentary History ({comments.length})</h4>

      {/* ── Security alert and intrusion banner layers ───────────────────── */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{sanitize(error)}</span>
          <button className="btn-close" onClick={() => setError(null)} type="button" aria-label="Dismiss error">×</button>
        </div>
      )}

      {rateLimitSeconds > 0 && (
        <div className="alert alert-warning" role="alert">
          ⏳ <strong>Velocity limit active:</strong> Please wait <strong>{rateLimitSeconds}s</strong> before posting comments.
        </div>
      )}

      {isArchived && (
        <div className="alert alert-info" role="alert">
          🔒 <strong>Read-Only Perimeter:</strong> Parent project is archived. Commentary addition and updates are fully restricted.
        </div>
      )}

      {/* ── Interactive Form — Enforces Rule 4 lock attributes ────────── */}
      <form onSubmit={handleCreateComment} className="comment-form">
        <div className="form-group">
          <textarea
            className="form-control"
            placeholder={isArchived ? "Thread is archived..." : "Write a collaborative workspace comment…"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={loading || isArchived || rateLimitSeconds > 0}
            rows="3"
            maxLength={1000}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={loading || isArchived || rateLimitSeconds > 0 || !newComment.trim()}
        >
          {loading ? 'Posting Spec…' : 'Post Comment'}
        </button>
      </form>

      {/* ── Comments Render Stream (OWASP Purified) ────────────────────── */}
      <div className="comments-list">
        {comments.length === 0 ? (
          <p className="text-muted">No commentary entries linked to this workspace asset parameter yet.</p>
        ) : (
          comments.map((comentario) => {
            const cleanAuthor = sanitize(comentario.authorId?.email || comentario.usuarioId?.email || 'Workspace Collaborator');
            const cleanBody = sanitize(comentario.body || comentario.contenido || comentario.content);
            const commentAuthorId = comentario.authorId?._id || comentario.authorId || comentario.usuarioId?._id || comentario.usuarioId;
            const hasOwnership = currentUserId && String(currentUserId) === String(commentAuthorId);

            return (
              <div key={comentario._id} className="comment-item">
                <div className="comment-header">
                  <strong>{cleanAuthor}</strong>
                  <small className="text-muted">
                    {new Date(comentario.createdAt).toLocaleString()}
                  </small>
                </div>

                {editingId === comentario._id ? (
                  <div className="comment-edit">
                    <textarea
                      className="form-control"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      disabled={loading}
                      rows="2"
                    />
                    <div className="comment-actions">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleUpdateComment(comentario._id)}
                        disabled={loading}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingId(null)}
                        disabled={loading}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="comment-content">{cleanBody}</p>
                    
                    {/* Actions panel — Blocked natively if project is archived */}
                    <div className="comment-actions">
                      {hasOwnership && !isArchived && (
                        <>
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => iniciarEdicion(comentario)}
                            disabled={loading || rateLimitSeconds > 0}
                            type="button"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleEliminarComentario(comentario._id)}
                            disabled={loading || rateLimitSeconds > 0}
                            type="button"
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CommentSection;