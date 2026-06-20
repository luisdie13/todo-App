import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

/**
 * Componente ProtectedRoute mejorado
 * 
 * ✅ Mientras isLoading === true: Muestra spinner/mensaje de carga
 * ✅ Mientras isAuthenticated === true: Renderiza la ruta protegida
 * ✅ Mientras isAuthenticated === false: Redirige a login
 * 
 * Esto evita que al hacer F5 en una ruta protegida, se redirija
 * prematuramente a login antes de que el refresh token se intente restaurar.
 */
export const ProtectedRoute = ({ isAuthenticated, isLoading }) => {
  // Si aún está verificando la autenticación, mostrar spinner
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0b0c10',
          color: '#ffffff',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '48px',
              marginBottom: '20px',
              animation: 'spin 1s linear infinite',
            }}
          >
            ⏳
          </div>
          <p style={{ fontSize: '18px' }}>Verificando sesión...</p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Si la verificación terminó y el usuario NO está autenticado, redirigir a login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado, renderizar la ruta protegida
  return <Outlet />;
};

export default ProtectedRoute;
