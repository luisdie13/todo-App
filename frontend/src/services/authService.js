import api from '../config/axios.config';
import { getAccessToken, getRefreshToken, setTokens, clearCredentials } from './tokenStorage';

export const login = async (email, password) => {
  try {
    const payload = { email, password };
    console.log("Payload enviado:", payload);
    const response = await api.post('/auth/login', payload);
    const { accessToken, refreshToken, usuario } = response.data;
    setTokens(accessToken, refreshToken);
    return { success: true, usuario };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Error en login'
    };
  }
};

export const register = async (email, password, name) => {
  try {
    const response = await api.post('/auth/registro', { email, password, name });
    const { accessToken, refreshToken, usuario } = response.data;
    setTokens(accessToken, refreshToken);
    return { success: true, usuario };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || 'Error en registro'
    };
  }
};

export const logout = async () => {
  try {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } catch (error) {
    console.error('Error en logout:', error);
  } finally {
    clearCredentials();
  }
};

export default api;
