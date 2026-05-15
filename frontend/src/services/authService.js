import api from '../config/axios.config';
import {
  saveCredentials,
  clearCredentials,
  getRefreshToken,
  setAccessToken
} from './tokenStorage';

/**
 * Servicio de autenticación del frontend
 * Maneja registro, login, logout y refresh de tokens
 */

/**
 * Registra un nuevo usuario
 */
export const register = async (email, password) => {
  try {
    const response = await api.post('/auth/registro', {
      email,
      password
    });

    const { usuario, accessToken, refreshToken } = response.data;

    // Guardar credenciales
    saveCredentials(accessToken, refreshToken, usuario);

    return {
      success: true,
      usuario,
      message: 'Registro exitoso'
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al registrar';
    return {
      success: false,
      error: errorMessage,
      message: errorMessage
    };
  }
};

/**
 * Inicia sesión de un usuario
 */
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password
    });

    const { usuario, accessToken, refreshToken } = response.data;

    // Guardar credenciales
    saveCredentials(accessToken, refreshToken, usuario);

    return {
      success: true,
      usuario,
      message: 'Sesión iniciada exitosamente'
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al iniciar sesión';
    return {
      success: false,
      error: errorMessage,
      message: errorMessage
    };
  }
};

/**
 * Cierra la sesión del usuario
 */
export const logout = async () => {
  try {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } catch (error) {
    console.error('Error al hacer logout en servidor:', error);
  } finally {
    // Siempre limpiar credenciales locales
    clearCredentials();
  }
};

/**
 * Refresca el access token
 */
export const refreshAccessToken = async () => {
  try {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post('/auth/refresh', {
      refreshToken
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data;

    // Actualizar tokens
    setAccessToken(accessToken);
    if (newRefreshToken) {
      localStorage.setItem('refreshToken', newRefreshToken);
    }

    return {
      success: true,
      accessToken
    };
  } catch (error) {
    console.error('Error al refrescar token:', error);
    clearCredentials();
    return {
      success: false,
      error: 'Error al refrescar token'
    };
  }
};

/**
 * Obtiene la información del usuario autenticado
 */
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return {
      success: true,
      usuario: response.data.usuario
    };
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    return {
      success: false,
      error: 'Error al obtener usuario'
    };
  }
};
