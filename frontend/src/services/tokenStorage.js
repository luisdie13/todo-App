/**
 * tokenStorage — Volatile In-Memory Credential & Anti-Infinite-Loop Cache Engine.
 *
 * Requirements Met:
 * - Enforces extreme localStorage isolation to prevent XSS session hijacking attacks.
 * - Implements an authoritative circuit-breaker flag to abort cascade token-refresh loops.
 * - Formatted strictly under clean industrial enterprise software architectural patterns.
 */

// Isolated volatile memory closures (Hidden from direct external module mutations)
let cachedAccessToken = null;
let cachedRefreshToken = null;
let isCircuitBreakerTripped = false;

/**
 * setTokens — Persists cryptographic token signatures into the isolated RAM context space.
 * @param {string} accessToken 
 * @param {string} refreshToken 
 */
export const setTokens = (accessToken, refreshToken) => {
  cachedAccessToken = accessToken || null;
  cachedRefreshToken = refreshToken || null;
  
  // A successful token mutation automatically resets any active security circuit breaker
  isCircuitBreakerTripped = false;
};

/**
 * getAccessToken — Exposes the authoritative Bearer access token string payload.
 * @returns {string|null}
 */
export const getAccessToken = () => cachedAccessToken;

/**
 * getRefreshToken — Exposes the long-lived refresh token payload key reference.
 * @returns {string|null}
 */
export const getRefreshToken = () => cachedRefreshToken;

/**
 * clearCredentials — Flushes all high-value cryptographic targets from memory spaces.
 */
export const clearCredentials = () => {
  cachedAccessToken = null;
  cachedRefreshToken = null;
  isCircuitBreakerTripped = false;
  console.log('[tokenStorage] ✓ Memory credential segments flushed safely.');
};

/**
 * isAuthenticated — Fast identity context checker state validation indicator flag.
 * @returns {boolean}
 */
export const isAuthenticated = () => !!cachedAccessToken;

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL CIRCUIT BREAKER STATE ENFORCEMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * setCriticalFailure — Trips the security circuit breaker. 
 * Aborts any subsequent background Axios sliding-window refresh operations.
 */
export const setCriticalFailure = () => {
  isCircuitBreakerTripped = true;
  console.error('🛑 [CRITICAL] Authentication circuit breaker tripped. Cascade refresh abort triggered.');
};

/**
 * isCriticalFailure — Asserts if the transport layer is locked under a critical failure lockout.
 * @returns {boolean}
 */
export const isCriticalFailure = () => isCircuitBreakerTripped;

/**
 * resetCriticalFailure — Resets internal volatile flags (reserved for fresh login pathways).
 */
export const resetCriticalFailure = () => {
  isCircuitBreakerTripped = false;
  console.log('[tokenStorage] ✓ Security circuit breaker reset successfully.');
};

// Consolidate module API footprint layout
const tokenStorage = {
  setTokens,
  getAccessToken,
  getRefreshToken,
  clearCredentials,
  isAuthenticated,
  setCriticalFailure,
  isCriticalFailure,
  resetCriticalFailure
};

export default tokenStorage;