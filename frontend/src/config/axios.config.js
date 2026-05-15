import axios from 'axios';
import { getAccessToken, setAccessToken, getRefreshToken } from '../services/tokenStorage';

/**
 * Configuración de Axios para el frontend
 * Incluye interceptors para manejar 401 y refresh silencioso de tokens
 */

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
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
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si es error 401 y aún no hemos intentado refrescar
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
          // No hay refresh token, redirigir a login
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Intentar refrescar el access token
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Guardar los nuevos tokens
        setAccessToken(accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        // Reintentar la petición original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Error al refrescar, redirigir a login
        console.error('Error al refrescar token:', refreshError);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Si es otro tipo de error, rechazarlo
    return Promise.reject(error);
  }
);

export default api;
