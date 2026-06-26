import React, { useState, useEffect, useRef, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Organization from './pages/Organization';
import Project from './pages/Project';
import { AuthProvider, AuthContext } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { getAccessToken, clearCredentials, setTokens } from './services/tokenStorage';
import api from './config/axios.config';
import './App.css';

// ============================================================
// INNER COMPONENT: AppRoutes
// Manages core infrastructure session lifecycle setups, 
// silent token rotations, and enforces global RBAC/ABAC route protections.
// ============================================================
function AppRoutes() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser]                       = useState(null);
  const [isLoading, setIsLoading]             = useState(true);
  const [isAuthReady, setIsAuthReady]         = useState(false);

  const { setLoading } = useContext(AuthContext);

  // Mitigation: Prevents infinite loop race conditions during token rotation
  const hasAttemptedRefreshRef = useRef(false);

  // ── Silent refresh initialization on mount ─────────────────────────────
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (hasAttemptedRefreshRef.current) {
          console.warn('⚠️ [SECURITY] Token rotation attempt blocked to prevent infinite cycle loops.');
          setIsAuthenticated(false);
          return;
        }

        const token = getAccessToken();

        if (token) {
          console.log('✓ Active access token resolved from secure in-memory storage context.');
          setIsAuthenticated(true);
        } else {
          console.log('🔄 No session token in memory. Initiating secure silent token rotation…');
          hasAttemptedRefreshRef.current = true;

          try {
            // Invokes the mandate endpoint via HttpOnly secure cookie parameters
            const refreshResponse = await api.post('/auth/refresh');

            if (refreshResponse.data?.accessToken) {
              console.log('✓ Secure token rotation successful. Re-establishing runtime variables.');
              setTokens(
                refreshResponse.data.accessToken,
                refreshResponse.data.refreshToken
              );

              // Instantly fetch full administrative context profiles
              try {
                const meResponse = await api.get('/auth/me');
                if (meResponse.data?.user) {
                  console.log('✓ Session user payload profile bound successfully.');
                  setUser(meResponse.data.user);
                } else {
                  setUser(null);
                }
              } catch (meError) {
                console.warn('⚠️ Authorization registry lookup failed:', meError.message);
                setUser(null);
              }

              setIsAuthenticated(true);
            } else {
              console.warn('⚠️ Token rotation rejected. Null or empty token payload received.');
              setIsAuthenticated(false);
              setUser(null);
            }
          } catch (refreshError) {
            console.log('ℹ️ Session lookup complete: No active session cookie parameters detected.');
            if (refreshError.response?.status === 401) {
              console.warn('⚠️ Stale or invalid refresh parameters. Executing secure workspace purge…');
              clearCredentials();
            }
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } catch (unexpectedError) {
        console.error('Critical authorization error detected during bootstrap:', unexpectedError);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        console.log('🔓 Infrastructure authorization complete. Releasing application pipeline thread.');
        setIsLoading(false);
        setLoading(false);
        setIsAuthReady(true);
      }
    };

    initializeAuth();
  }, [setLoading]);

  // ── Blocking layout render while parsing authentication signatures ──
  if (!isAuthReady || isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0b0c10',
          fontFamily: 'sans-serif'
        }}
        role="alert"
        aria-live="polite"
        aria-busy="true"
      >
        <p style={{ color: '#ffffff', fontSize: '18px', letterSpacing: '0.5px' }}>
          Verifying secure communication channel parameters…
        </p>
      </div>
    );
  }

  // ── Session state mutator bindings ──────────────────────────────────────
  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    clearCredentials();
    setIsAuthenticated(false);
    setUser(null);
  };

  // ── Full-Stack Route Tree Configuration ─────────────────────────────────
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public Routes (OWASP Login / Register boundaries) ──────────── */}
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <Register onRegister={handleLogin} />
          }
        />

        {/* ── Authenticated Routes (General Workspace passing layers) ────── */}
        <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading} user={user} />}>
          
          {/* Default User Landing Core View */}
          <Route path="/dashboard" element={<Dashboard user={user} onLogout={handleLogout} />} />
          
          {/* Contextual Management Routes */}
          <Route path="/organization/:organizationId" element={<Organization user={user} onLogout={handleLogout} />} />
          <Route path="/project/:projectId" element={<Project user={user} onLogout={handleLogout} />} />
          <Route path="/projects/:projectId" element={<Navigate to="/project/:projectId" replace />} />
        </Route>

        {/* ── SuperAdmin Protected Routes (Strict Client-Side RBAC Enforcement) ── */}
        <Route element={
          <ProtectedRoute 
            isAuthenticated={isAuthenticated} 
            isLoading={isLoading} 
            user={user} 
            allowedRoles={['super_admin']} 
          />
        }>
          {/* Saves structural overhead by routing the admin directly into the 
            centralized console panel hooks we established inside Dashboard view.
          */}
          <Route path="/admin/users" element={<Dashboard user={user} onLogout={handleLogout} initialTab="users" />} />
          <Route path="/admin/audit-logs" element={<Dashboard user={user} onLogout={handleLogout} initialTab="audit" />} />
        </Route>

        {/* ── Fallback Catch-All Layer ───────────────────────────────────── */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

// ============================================================
// ROOT APPLICATION INJECTION
// Envelops the reactive state pipeline under the AuthProvider.
// ============================================================
function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;