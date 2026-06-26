import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { login } from '../services/authService';
import '../styles/Auth.css';

/**
 * Login Component — Secure authentication gateway for SecureCollab.
 * * Enforces security requirements:
 * - Sanitizes user input via DOMPurify before dispatching payloads (OWASP XSS Mitigation).
 * - Implements live, dynamic countdown timers when blocked by HTTP 429 Rate Limiting.
 * - Restricts navigation vectors to reactive SPA Link bindings to preserve in-memory token state.
 */
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // ── Rate Limiting Live State Trackers (Class 9 Mitigation) ──────────────────
  const [rateLimited, setRateLimited] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  
  const navigate = useNavigate();
  const timerRef = useRef(null);

  // Clear running reference intervals upon component destruction to prevent leaks
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── DOMPurify Strict Plain Text Helper ────────────────────────────────────
  const sanitizeInput = (value) => {
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  };

  // ── Dynamic Countdown Timer Trigger ───────────────────────────────────────
  const startCountdown = (durationInSeconds) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    setRateLimited(true);
    setSecondsLeft(durationInSeconds);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
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
    setLoading(true);

    // OWASP Input Sanitization check before network dispatching
    const sanitizedEmail = sanitizeInput(email);

    if (!sanitizedEmail) {
      setError('Please provide a valid email address.');
      setLoading(false);
      return;
    }

    const result = await login(sanitizedEmail, password);
    setLoading(false);

    if (result?.success) {
      // Maps underlying payload structures cleanly to parent state node
      onLogin(result.user || result.usuario);
      navigate('/dashboard');
    } else {
      // Capture HTTP 429 Rate Limiting attributes cleanly from API response payload
      if (result?.status === 429 || result?.statusCode === 429) {
        const retryAfterSeconds = parseInt(result.retryAfter || 60, 10);
        setError(`Too many authentication failures. Execution threshold reached.`);
        startCountdown(retryAfterSeconds);
      } else {
        setError(result?.error || 'Invalid credentials. Please verify your data.');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-brand">🔒 SecureCollab</h1>
        <h2 className="auth-subtitle">Sign In to Your Account</h2>
        
        {/* ── Error and Intrusion Banners ─────────────────────────────────── */}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {rateLimited && (
          <div className="alert alert-warning" role="alert">
            ⚠️ Brute-force protection active. Please wait <strong>{secondsLeft}s</strong> before retrying.
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || rateLimited}
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || rateLimited}
              autoComplete="current-password"
            />
          </div>
          
          <button 
            type="submit" 
            className={`btn btn-primary ${rateLimited ? 'btn-disabled' : ''}`} 
            disabled={loading || rateLimited}
          >
            {loading ? 'Authenticating…' : rateLimited ? 'Button Disabled' : 'Sign In'}
          </button>
        </form>
        
        <p className="auth-link">
          Don't have an account? <Link to="/register" className="link-redirect">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;