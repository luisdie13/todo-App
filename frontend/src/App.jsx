import React, { useState, useEffect, useRef, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Organization from './pages/Organization';
import Project from './pages/Project';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { getAccessToken, clearCredentials, setTokens } from './services/tokenStorage';
import api from './config/axios.config';
import './App.css';

// ============================================================
// COMPONENTE INTERNO: AppRoutes (dentro del AuthProvider)
// ============================================================
function AppRoutes() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(() => {
    // NO recuperar usuario del localStorage (nunca almacenar datos sensibles)
    // El usuario se establece solo después del login exitoso
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // ============================================================
  // SINCRONIZACIÓN: Obtener context y actualizar authLoading
  // ============================================================
  const { setLoading } = useContext(AuthContext);

  // ============================================================
  // BANDERA DE CONTROL: Evitar múltiples intentos de refresh
  // ============================================================
  const hasAttemptedRefreshRef = useRef(false);

   useEffect(() => {
      // Silent Refresh: Intentar refrescar la sesión al montar la app
      const initializeAuth = async () => {
        try {
          // PROTECCIÓN: Prevenir múltiples intentos de refresh en el mismo ciclo
          if (hasAttemptedRefreshRef.current) {
            console.warn('⚠️  [PROTECCIÓN] Ya se intentó refresh en este ciclo. Evitando re-intento.');
            setIsAuthenticated(false);
            // NO apagar loading aquí - dejar que el finally lo haga
            return;
          }

          const token = getAccessToken();
          
          if (token) {
            // Ya hay token en memoria, mantener sesión
            console.log('✓ Token existente en memoria. Sesión activa.');
            setIsAuthenticated(true);
            // Aún NO apagamos loading - esperar a que el finally lo haga
          } else {
            // No hay token en memoria, intentar refresh silencioso UNA SOLA VEZ
            // La cookie HttpOnly será enviada automáticamente por el navegador
            console.log('🔄 Intentando refresh silencioso...');
            
            // Marcar que ya estamos intentando (ANTES de hacer la petición)
            hasAttemptedRefreshRef.current = true;
            
            try {
              const response = await api.post('/auth/refresh');
              
              if (response.data?.accessToken) {
                // Refresh exitoso, guardar tokens en memoria
                console.log('✓ Refresh exitoso. Sesión restaurada.');
                setTokens(response.data.accessToken, response.data.refreshToken);
                
                // CRÍTICO: Esperar a obtener datos del usuario ANTES de apagar loading
                try {
                  const userDataResponse = await api.get('/auth/me');
                  if (userDataResponse.data?.user) {
                    console.log('✓ Datos del usuario obtenidos tras refresh:', userDataResponse.data.user);
                    setUser(userDataResponse.data.user);
                    console.log('✅ Usuario guardado en memoria. Sistema listo.');
                  } else {
                    console.warn('⚠️  No se obtuvieron datos válidos del usuario.');
                    setUser(null);
                  }
                } catch (userError) {
                  console.warn('⚠️  No se pudieron obtener datos del usuario tras refresh:', userError.message);
                  setUser(null);
                }
                
                setIsAuthenticated(true);
              } else {
                // No se obtuvo token, redirigir a login
                console.warn('⚠️  No se obtuvo accessToken del refresh.');
                setIsAuthenticated(false);
                setUser(null);
              }
            } catch (refreshError) {
              // Refresh falló, pero no hacer logout inmediato
              // El usuario podría no tener sesión válida, pero permitir que intente
              console.log('ℹ️  No active session on refresh');
              
              // Si el error fue 401 (token expirado/inválido), limpiar completamente
              if (refreshError.response?.status === 401) {
                console.warn('⚠️  Token inválido o expirado. Limpiando sesión...');
                clearCredentials();
              }
              
              setIsAuthenticated(false);
              setUser(null);
            }
          }
        } catch (error) {
          // Captura cualquier error inesperado
          console.error('Error inesperado en initializeAuth:', error);
          setIsAuthenticated(false);
          setUser(null);
        } finally {
          // ⭐⭐⭐ CRÍTICO: SIEMPRE liberamos el loader AQUÍ, después de TODA la lógica secuencial
          // Esto garantiza que:
          // 1. El refresh se intentó (si no había token en memoria)
          // 2. Se obtuvieron los datos del usuario (si el refresh fue exitoso)
          // 3. React tiene los datos de usuario en estado ANTES de renderizar rutas
          console.log('🔓 Liberando loading. Sistema completamente inicializado.');
          setIsLoading(false);
          setLoading(false);
          
          // SINCRONIZACIÓN CRÍTICA: Marca que la inicialización de autenticación ha terminado
          // Esto desbloquea la renderización del router después de que toda la lógica de
          // refresh silencioso se haya completado (exitosa o no)
          setIsAuthReady(true);
        }
      };

      initializeAuth();
    }, [setLoading]);

  // ============================================================
  // BLOQUEO CRÍTICO: No renderizar router hasta que isAuthReady sea true
  // ============================================================
  // Esto previene que React Router ejecute redirects antes de que el refresh
  // silencioso haya completado la mutación del estado global de autenticación
  if (!isAuthReady) {
    return (
      <div className="bg-dark min-h-screen text-white p-5" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0b0c10' }}>
        <p style={{ color: '#ffffff', fontSize: '18px' }}>Cargando aplicación...</p>
      </div>
    );
  }

  if (isLoading) {
    // Mostrar un loader mientras se verifica la sesión
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0b0c10' }}>
        <p style={{ color: '#ffffff', fontSize: '18px' }}>Verificando sesión...</p>
      </div>
    );
  }

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    clearCredentials();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register onRegister={handleLogin} />} />
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/organization/:organizationId" element={isAuthenticated ? <Organization user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/projects/:projectId" element={isAuthenticated ? <Project user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/project/:projectId" element={isAuthenticated ? <Project user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL: App (envuelve con AuthProvider)
// ============================================================
function App() {
  return (
    <AuthProvider user={null}>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
