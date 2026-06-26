import axios from 'axios';
import { 
  getAccessToken, 
  setTokens, 
  getRefreshToken, 
  clearCredentials 
} from '../services/tokenStorage';

// ── Shared Private State Flags ─────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];
let refreshHasFailedCritically = false;

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * activateBrakePad — Extreme fallback exception handler.
 */
const activateBrakePad = () => {
  if (refreshHasFailedCritically) return; // Ya ejecutado
  refreshHasFailedCritically = true;
  isRefreshing = false;
  failedQueue = [];
  
  clearCredentials();
  console.log('✓ In-memory authorization store flushed.');
};

/**
 * processQueue — Dispatches or drops enqueued requests.
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach((promise) => {
    if (error) promise.reject(error);
    else promise.resolve(token);
  });
  failedQueue = [];
};

// ── Core API Instantiation ──────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

const refreshInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  withCredentials: true
});

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 1. Evitar loops de refresco
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    // 2. Manejo de 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err) => reject(err)
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        // Rotación de token
        const response = await refreshInstance.post('/auth/refresh');
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        setTokens(accessToken, newRefreshToken || refreshToken);
        
        isRefreshing = false;
        processQueue(null, accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        activateBrakePad();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;