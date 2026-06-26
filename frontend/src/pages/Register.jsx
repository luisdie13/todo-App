import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { register } from '../services/authService';
import '../styles/Auth.css';

/**
 * Register Component — Secure account creation gateway for SecureCollab.
 * Enforces technical guidelines:
 * - Limits registration request bursts by intercepting HTTP 429 Rate Limiting attributes (Class 9).
 * - Restricts input payloads using a strict plain-text DOMPurify configuration (OWASP XSS).
 * - Preserves in-memory token contexts via React Router Link elements.
 */
function Register({ onRegister }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  // ── Rate Limiting State Trackers (Class 9 Mitigation — 3 requests/hr) ──────
  const [rateLimited, setRateLimited] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const navigate = useNavigate();
  const countdownTimerRef = useRef(null);

  // Clear pending interval execution threads on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // ── DOMPurify Strict Plain Text Helper ────────────────────────────────────
  const sanitizeInput = (value) => {
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  };

  // ── Dynamic Countdown Timer Trigger ───────────────────────────────────────
  const startRateLimitCountdown = (durationSeconds) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    setRateLimited(true);
    setSecondsLeft(durationSeconds);

    countdownTimerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          setRateLimited(false);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rateLimited || loading) return;

    setError('');
    setValidationErrors({});

    if (password !== passwordConfirm) {
      setError('Passwords do not match. Please verify your credentials.');
      return;
    }

    // Strict client-side OWASP sanitization to neutralize potential XSS vectors
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);

    if (!sanitizedName || !sanitizedEmail) {
      setError('Form inputs contain invalid or restricted character parameters.');
      return;
    }

    setLoading(true);
    const result = await register(sanitizedEmail, password, sanitizedName);
    setLoading(false);

    if (result?.success) {
      // Maps underlying payload fields cleanly to the global parent memory scope
      onRegister(result.user || result.usuario);
      navigate('/dashboard');
    } else {
      // Intercept execution threshold limitations (HTTP 429 Rate Limiting)
      if (result?.status === 429 || result?.statusCode === 429) {
        const retryAfterSeconds = parseInt(result.retryAfter || 3600, 10);
        setError('Registration velocity threshold reached. Action blocked by security policy.');
        startRateLimitCountdown(retryAfterSeconds);
      } else if (result?.validationErrors) {
        setValidationErrors(result.validationErrors);
      } else {
        setError(result?.error || 'Registration failed. Please verify your data schema fields.');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-brand">🔒 SecureCollab</h1>
        <h2 className="auth-subtitle">Create Your Account</h2>
        
        {/* ── Error & Security Warning Banners ────────────────────────────── */}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {rateLimited && (
          <div className="alert alert-warning" role="alert">
            ⚠️ Brute-force threshold active. Please wait <strong>{secondsLeft}s</strong> before attempting registration.
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading || rateLimited}
              className={validationErrors.name ? 'input-error' : ''}
              autoComplete="name"
            />
            {validationErrors.name && <span className="error-text">{validationErrors.name}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || rateLimited}
              className={validationErrors.email ? 'input-error' : ''}
              autoComplete="email"
            />
            {validationErrors.email && <span className="error-text">{validationErrors.email}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || rateLimited}
              className={validationErrors.password ? 'input-error' : ''}
              autoComplete="new-password"
            />
            {validationErrors.password && <span className="error-text">{validationErrors.password}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              placeholder="Re-enter your password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              disabled={loading || rateLimited}
              autoComplete="new-password"
            />
          </div>
          
          <button 
            type="submit" 
            className={`btn btn-primary ${rateLimited ? 'btn-disabled' : ''}`} 
            disabled={loading || rateLimited}
          >
            {loading ? 'Processing Registry…' : rateLimited ? 'Button Disabled' : 'Register Account'}
          </button>
        </form>
        
        <p className="auth-link">
          Already have an account? <Link to="/login" className="link-redirect">Sign In here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;