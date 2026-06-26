import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import api from '../config/axios.config';

/**
 * CommentsPanel — Secure task commentary tracker for SecureCollab.
 * Enforces technical guidelines:
 * - Implements dynamic UI locks for Class 9 Rate Limiting (20 comments/min).
 * - Enforces Rule 4 governance criteria by freezing threads if isLocked is triggered.
 * - Sanitizes interactive user entries to neutralize cross-site scripting vectors (XSS).
 */
function CommentsPanel({ taskId, isOpen = false, isLocked = false }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // ── DOMPurify Strict Plain Text Helper (OWASP Mitigation) ──────────────
  const sanitize = useCallback((value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  }, []);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Compliance check: aligned to correct API REST route naming conventions
      const response = await api.get(`/tasks/${taskId}/comments`);
      
      // Parse payload dynamically according to backend response mapping
      const commentData = response.data?.comments || response.data?.comentarios || response.data || [];
      setComments(Array.isArray(commentData) ? commentData : []);
    } catch (err) {
      console.error('[CommentsPanel] Failed to sync comment registry records:', err);
      setError('Failed to load secure commentary threads.');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen && taskId) {
      loadComments();
    }
  }, [taskId, isOpen, loadComments]);

  // Live countdown timer execution thread for HTTP 429 anomalies
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    
    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (isLocked || loading || rateLimitSeconds > 0) return;
    
    const cleanComment = sanitize(newComment);

    if (!cleanComment) {
      setError('Comment field specification parameters cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Formats data object cleanly under the strict specification model boundary 'body'
      const response = await api.post(`/tasks/${taskId}/comments`, {
        body: cleanComment
      });

      const freshComment = response.data?.comment || response.data?.comentario || response.data;
      setComments((prev) => [...prev, freshComment]);
      setNewComment('');
    } catch (err) {
      console.error('[CommentsPanel] Post execution rejected:', err);
      
      // Capture burst threshold exceptions in real time (Class 9 Rate Limiting)
      if (err.response?.status === 429) {
        const retryAfterValue = parseInt(err.response.headers['retry-after'] || '60', 10);
        setRateLimitSeconds(retryAfterValue);
        setError(`Sprinting comment threshold triggered.`);
        return;
      }

      const msg = err.response?.data?.error || 'Access Denied: Action blocked by contextual rule limits.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (isLocked) return;
    if (!window.confirm('Are you sure you want to permanently erase this comment entry?')) return;

    try {
      setError('');
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      console.error('[CommentsPanel] Destructive delete action aborted:', err);
      setError(err.response?.data?.error || 'Action Denied: You lack permissions to drop this record.');
    }
  };

  return (
    <div className="comments-panel">
      <h4>💬 Task Commentary</h4>

      {/* ── Banners & Validation Error Notices ──────────────────────────── */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {sanitize(error)}
        </div>
      )}

      {rateLimitSeconds > 0 && (
        <div className="alert alert-warning" role="alert">
          ⏳ Too many operational requests. Please wait <strong>{rateLimitSeconds}s</strong> before posting again.
        </div>
      )}

      {isLocked && (
        <div className="alert alert-info-lock" role="alert">
          🔒 Thread Locked: Parent project is archived. System governance blocks adding or purging items.
        </div>
      )}

      {/* ── Comments Feed List ─────────────────────────────────────────── */}
      <div className="comments-list">
        {loading && comments.length === 0 ? (
          <p className="text-muted">Syncing commentary workspace indices…</p>
        ) : comments.length === 0 ? (
          <p className="text-muted">No commentary entries pinned to this task resource parameter yet.</p>
        ) : (
          comments.map((comment) => {
            const cleanAuthor = sanitize(comment.authorId?.email || comment.usuarioId?.email || 'Workspace Collaborator');
            const cleanBody = sanitize(comment.body || comment.content || comment.contenido);
            
            return (
              <div key={comment._id} className="comment-item">
                <div className="comment-header">
                  <strong>{cleanAuthor}</strong>
                  <span className="comment-date">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="comment-content">
                  {cleanBody}
                </div>
                
                {/* Delete Trigger — Hidden natively if project locked parameter resolves true */}
                {!isLocked && (
                  <div className="comment-actions">
                    <button
                      className="btn-link-action text-danger"
                      onClick={() => handleDeleteComment(comment._id)}
                      disabled={loading || rateLimitSeconds > 0}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Interactive Input Form ────────────────────────────────────── */}
      <form onSubmit={handleAddComment} className="comment-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={isLocked ? "Thread is archived..." : "Write a collaborative comment…"}
          rows={3}
          disabled={loading || isLocked || rateLimitSeconds > 0}
          className="comment-input"
          maxLength={1000}
        />
        <button 
          type="submit" 
          className="btn btn-primary btn-sm"
          disabled={loading || isLocked || rateLimitSeconds > 0 || !newComment.trim()}
        >
          {loading ? 'Posting Spec…' : rateLimitSeconds > 0 ? 'Rate Limited' : '📝 Post Comment'}
        </button>
      </form>
    </div>
  );
}

export default CommentsPanel;