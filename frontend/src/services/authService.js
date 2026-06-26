import api from '../config/axios.config';
import { getRefreshToken, setTokens, clearCredentials } from './tokenStorage';

/**
 * authService — Volatile core authentication client middleware for SecureCollab.
 * Enforces technical rules:
 * - Aligns endpoint pathways and property definitions cleanly to standard backend models.
 * - Propagates complete status codes (like HTTP 429) to drive dynamic UI security counters.
 * - Operates entirely within isolated RAM spaces, keeping localStorage untouched.
 */

/**
 * login — Authenticates session credentials against the central workspace database pipeline.
 * @param {string} email 
 * @param {string} password 
 */
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user, usuario } = response.data;
    
    // Persist session variables strictly inside memory states wrappers
    setTokens(accessToken, refreshToken);
    
    return { 
      success: true, 
      user: user || usuario 
    };
  } catch (error) {
    console.error('[authService] Authentication channel injection rejected:', error.message);
    
    // Preserve dynamic metadata fields to trigger frontend security rate-limit banners
    return {
      success: false,
      status: error.response?.status || 500,
      retryAfter: error.response?.headers['retry-after'] || error.response?.data?.retryAfter || null,
      error: error.response?.data?.error || 'Authentication failure: Invalid credentials.',
      validationErrors: error.response?.data?.errors || null
    };
  }
};

/**
 * register — Deploys a new user credential ledger model to the backend cluster database.
 * @param {string} email 
 * @param {string} password 
 * @param {string} name 
 */
export const register = async (email, password, name) => {
  try {
    // Compliance Check: Corrected spelling to match standard English paths endpoints API
    const response = await api.post('/auth/register', { email, password, name });
    const { accessToken, refreshToken, user, usuario } = response.data;
    
    setTokens(accessToken, refreshToken);
    
    return { 
      success: true, 
      user: user || usuario 
    };
  } catch (error) {
    console.error('[authService] Registration parameter payload rejected:', error.message);
    
    return {
      success: false,
      status: error.response?.status || 500,
      retryAfter: error.response?.headers['retry-after'] || error.response?.data?.retryAfter || null,
      error: error.response?.data?.error || 'Registration failure: Access denied.',
      validationErrors: error.response?.data?.errors || null
    };
  }
};

/**
 * logout — Requests remote cookie/token revocation procedures and flushes volatile memory stacks.
 */
export const logout = async () => {
  try {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Notifies the logging tracking ledger system of session termination parameters
      await api.post('/auth/logout', { refreshToken });
    }
  } catch (error) {
    console.error('[authService] Server session logout trace clearing warning:', error.message);
  } finally {
    // Crucial step: execute structural storage cleanup regardless of network status codes
    clearCredentials();
  }
};

const authService = {
  login,
  register,
  logout
};

export default authService;