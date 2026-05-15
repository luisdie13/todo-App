/**
 * Servicio de almacenamiento de tokens
 * Maneja la persistencia y recuperación de tokens del localStorage
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

/**
 * Obtiene el access token del localStorage
 */
export const getAccessToken = () => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Guarda el access token en localStorage
 */
export const setAccessToken = (token) => {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
};

/**
 * Obtiene el refresh token del localStorage
 */
export const getRefreshToken = () => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Guarda el refresh token en localStorage
 */
export const setRefreshToken = (token) => {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

/**
 * Obtiene la información del usuario del localStorage
 */
export const getUser = () => {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * Guarda la información del usuario en localStorage
 */
export const setUser = (user) => {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

/**
 * Guarda todos los tokens y usuario tras login exitoso
 */
export const saveCredentials = (accessToken, refreshToken, user) => {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
  setUser(user);
};

/**
 * Limpia todos los tokens y usuario (logout)
 */
export const clearCredentials = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Verifica si hay un usuario autenticado
 */
export const isAuthenticated = () => {
  return !!getAccessToken() && !!getRefreshToken();
};

/**
 * Decodifica un JWT para obtener su payload (sin verificación)
 * Solo uso para verificar información básica del token
 */
export const decodeToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch (error) {
    console.error('Error decodificando token:', error);
    return null;
  }
};

/**
 * Verifica si el access token está próximo a expirar (dentro de 5 minutos)
 */
export const isAccessTokenExpiringSoon = () => {
  const token = getAccessToken();
  if (!token) return true;

  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  // exp está en segundos, convertir a milisegundos
  const expirationTime = decoded.exp * 1000;
  const currentTime = Date.now();
  const timeUntilExpiry = expirationTime - currentTime;

  // Retornar true si expira en menos de 5 minutos
  return timeUntilExpiry < 5 * 60 * 1000;
};
