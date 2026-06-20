import axios from 'axios';
import { getAccessToken, setTokens, getRefreshToken, clearCredentials, isCriticalFailure, setCriticalFailure } from '../services/tokenStorage';

/**
 * Configuración de Axios para el frontend
 * Incluye interceptors para manejar 401 y refresh silencioso de tokens
 */

// ============================================================
// MECANISMO DE FRENO DE MANO PARA EVITAR BUCLE INFINITO
// ============================================================

// Bandera de control para evitar bucle infinito de refresh
let isRefreshing = false;
let failedQueue = [];

// FRENO DE MANO: Bandera para evitar reintentos después de fallo crítico
let refreshHasFailedCritically = false;

// Función para ejecutar el "freno de mano" - detener todo y limpiar
const activateBrakePad = () => {
  console.error('🛑 [FRENO DE MANO ACTIVADO] Deteniendo bucle infinito de refresh...');
  
  // 1. Marcar que ha fallado críticamente (prevenir reintentos)
  refreshHasFailedCritically = true;
  
  // 2. Resetear banderas de refresh
  isRefreshing = false;
  failedQueue = [];
  
  // 3. Limpiar COMPLETAMENTE todo almacenamiento
  try {
    // Limpiar localStorage
    localStorage.clear();
    console.log('✓ localStorage limpiado');
  } catch (e) {
    console.warn('⚠️  No se pudo limpiar localStorage:', e.message);
  }
  
  try {
    // Limpiar sessionStorage
    sessionStorage.clear();
    console.log('✓ sessionStorage limpiado');
  } catch (e) {
    console.warn('⚠️  No se pudo limpiar sessionStorage:', e.message);
  }
  
  try {
    // Limpiar cookies (removiendo cookies auth conocidas)
    document.cookie.split(";").forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      if (cookieName.toLowerCase().includes('token') || 
          cookieName.toLowerCase().includes('auth') ||
          cookieName.toLowerCase().includes('session')) {
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      }
    });
    console.log('✓ Cookies de autenticación limpiadas');
  } catch (e) {
    console.warn('⚠️  No se pudo limpiar cookies:', e.message);
  }
  
  // 4. Importar y limpiar tokens en memoria
  clearCredentials();
  console.log('✓ Tokens en memoria limpiados');
};

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Interceptor de Request
 * Agrega el access token a cada petición
 */
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Interceptor de Response
 * Maneja errores 401 y realiza refresh silencioso del token
 * IMPORTANTE: NO almacena tokens en localStorage (solo en memoria)
 * 
 * MECANISMO DE CONTROL:
 * - isRefreshing evita múltiples intentos de refresh simultáneos
 * - failedQueue almacena peticiones pendientes durante el refresh
 * - Si el refresh falla, se limpian credenciales y se redirige a login
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ============================================================
    // PROTECCIÓN CRÍTICA: Si la petición YA es /auth/refresh,
    // NO intentar reintentar. Rechazar inmediatamente.
    // ============================================================
    if (originalRequest.url?.includes('/auth/refresh')) {
      console.error('🛑 [FRENO CRÍTICO] La petición /auth/refresh falló. No reintentar.');
      console.error(`📍 Detalles del error: ${error.response?.status} - ${error.message}`);
      activateBrakePad();
      return Promise.reject(error);
    }

    // Si es error 429 (Rate Limited), NO reintentar automáticamente
    if (error.response?.status === 429) {
      console.error('⚠️  [RATE LIMIT 429] Demasiadas solicitudes. El servidor rechazó la petición.');
      console.error(`📍 Endpoint: ${originalRequest.method} ${originalRequest.url}`);
      console.error('💡 Espera unos minutos antes de intentar de nuevo.');
      // Rechazar inmediatamente sin reintentos
      return Promise.reject(error);
    }

    // Si es error 401 y aún no hemos intentado refrescar
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // PROTECCIÓN: Si ya hemos fallado críticamente, no reintentar
      if (refreshHasFailedCritically) {
        console.warn('⚠️  [PROTECCIÓN] Bucle de refresh ya fallido. Rechazando petición.');
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;

      if (isRefreshing) {
        // Ya hay un refresh en progreso, encolar esta petición
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err) => {
              reject(err);
            }
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
          // No hay refresh token, limpiar y redirigir a login
          isRefreshing = false;
          clearCredentials();
          processQueue(error, null);
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Intentar refrescar el access token (usando HttpOnly Cookie)
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Guardar los nuevos tokens EN MEMORIA
        if (newRefreshToken !== undefined) {
          setTokens(accessToken, newRefreshToken);
        } else {
          setTokens(accessToken, getRefreshToken());
        }

        // Procesar peticiones en cola con el nuevo token
        isRefreshing = false;
        processQueue(null, accessToken);

        // Reintentar la petición original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // ============================================================
        // ACTIVAR FRENO DE MANO: Error al refrescar token
        // ============================================================
        console.error('❌ Error CRÍTICO al refrescar token:', refreshError.message);
        console.error('📍 Endpoint fallido: POST /api/auth/refresh');
        
        // Detectar si el error es 401 en /refresh (refresh token expirado/inválido)
        if (refreshError.response?.status === 401) {
          console.error('⚠️  El refresh token es inválido o expiró. ACTIVANDO FRENO DE MANO...');
        }
        
        // ACTIVAR EL FRENO DE MANO: Función que detiene TODO y limpia
        activateBrakePad();
        
        // Rechazar todas las peticiones en cola
        processQueue(refreshError, null);
        
        // Forzar redirección limpia (borra estado de React en memoria)
        // Usar setTimeout para asegurar que los logs se hayan enviado
        setTimeout(() => {
          window.location.href = '/login?reason=auth_required';
        }, 100);
        
        return Promise.reject(refreshError);
      }
    }

    // Si es otro tipo de error, rechazarlo
    return Promise.reject(error);
  }
);

export default api;
