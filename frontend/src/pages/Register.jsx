import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { register } from '../services/authService';
import '../styles/Auth.css';

function Register({ onRegister }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Sanitizar inputs con DOMPurify antes de enviar
    const sanitizedName = DOMPurify.sanitize(name);
    const sanitizedEmail = DOMPurify.sanitize(email);

    setLoading(true);
    const result = await register(sanitizedEmail, password, sanitizedName);
    setLoading(false);

    if (result.success) {
      onRegister(result.usuario);
      navigate('/dashboard');
    } else {
      if (result.validationErrors) {
        setValidationErrors(result.validationErrors);
      } else {
        setError(result.error);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>SecureCollab</h1>
        <h2>Crear cuenta</h2>
        
        {error && <div className="alert alert-danger">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre</label>
            <input
              type="text"
              placeholder="Tu nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
            {validationErrors.name && <span className="error-text">{validationErrors.name}</span>}
          </div>
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            {validationErrors.email && <span className="error-text">{validationErrors.email}</span>}
          </div>
          
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            {validationErrors.password && <span className="error-text">{validationErrors.password}</span>}
          </div>
          
          <div className="form-group">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrarme'}
          </button>
        </form>
        
        <p className="auth-link">
          ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
        </p>
      </div>
    </div>
  );
}

export default Register;
