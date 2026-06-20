// Almacenamiento en memoria para tokens
let accessToken = null;
let refreshToken = null;

// ============================================================
// BANDERA DE CRÍTICO FALLIDO: Evitar bucle infinito
// ============================================================
let criticalFailureState = false;

export const setTokens = (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
  // Si guardamos tokens exitosamente, resetear el estado crítico
  criticalFailureState = false;
};

export const getAccessToken = () => accessToken;

export const getRefreshToken = () => refreshToken;

export const clearCredentials = () => {
  accessToken = null;
  refreshToken = null;
  console.log('✓ Credenciales limpiadas');
};

export const isAuthenticated = () => !!accessToken;

// ============================================================
// MÉTODOS DE CONTROL DE ESTADO CRÍTICO
// ============================================================

/**
 * Marca que hemos entrado en un estado de fallo crítico
 * Esto previene reintentos infinitos de refresh
 */
export const setCriticalFailure = () => {
  criticalFailureState = true;
  console.error('🛑 [CRÍTICO] Marcado como fallo crítico. No se intentarán más refreshes.');
};

/**
 * Verifica si estamos en un estado de fallo crítico
 */
export const isCriticalFailure = () => {
  return criticalFailureState;
};

/**
 * Resetea el estado crítico (solo para login exitoso)
 */
export const resetCriticalFailure = () => {
  criticalFailureState = false;
  console.log('✓ Estado crítico reseteado');
};
