const authService = require('../services/auth.service');
const auditLogService = require('../services/auditLog.service');

/**
 * Controlador de Autenticación
 * Maneja requests y responses de auth
 */

/**
 * POST /api/auth/register
 * Registra un nuevo usuario
 */
const register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validación básica
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email y password son requeridos' 
      });
    }

    // Llamar al servicio de autenticación
    const resultado = await authService.registro(email, password, req);

    // Retornar usuario y tokens
    return res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
      refreshToken: resultado.refreshToken
    });

  } catch (err) {
    console.error('Error en register:', err.message);

    // Manejar errores específicos
    if (err.message === 'El correo ya está registrado') {
      return res.status(409).json({ 
        error: 'El correo ya está registrado' 
      });
    }

    // Pasar al middleware de errores
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Inicia sesión de un usuario
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validación básica
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email y password son requeridos' 
      });
    }

    // Llamar al servicio de autenticación
    const resultado = await authService.login(email, password, req);

    // Retornar usuario y tokens
    return res.status(200).json({
      mensaje: 'Sesión iniciada exitosamente',
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
      refreshToken: resultado.refreshToken
    });

  } catch (err) {
    console.error('Error en login:', err.message);

    // Registrar intento fallido si no se registró en el servicio
    if (err.message === 'Credenciales inválidas') {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Pasar al middleware de errores
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Refresca el access token usando el refresh token
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token es requerido' 
      });
    }

    const tokenService = require('../services/tokenService');
    const tokens = tokenService.refreshAccessToken(refreshToken);

    return res.status(200).json({
      mensaje: 'Token refrescado exitosamente',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });

  } catch (err) {
    console.error('Error en refresh:', err.message);

    if (err.message.includes('Invalid') || err.message.includes('revoked')) {
      return res.status(401).json({ 
        error: 'Refresh token inválido o revocado' 
      });
    }

    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Cierra la sesión del usuario
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token es requerido' 
      });
    }

    const tokenService = require('../services/tokenService');
    tokenService.revokeRefreshToken(refreshToken);

    // Registrar evento de logout
    const email = req.body?.email || 'unknown';
    await auditLogService.log('auth.logout', req, {
      email,
      statusCode: 200,
      detalles: 'Logout exitoso'
    });

    return res.status(200).json({ 
      mensaje: 'Sesión cerrada exitosamente' 
    });

  } catch (err) {
    console.error('Error en logout:', err.message);
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Obtiene la información del usuario autenticado
 * (Requiere middleware de autenticación)
 */
const getMe = async (req, res, next) => {
  try {
    // req.user debería ser establecido por el middleware de autenticación
    if (!req.user) {
      return res.status(401).json({ 
        error: 'No autenticado' 
      });
    }

    return res.status(200).json({
      usuario: req.user
    });

  } catch (err) {
    console.error('Error en getMe:', err.message);
    next(err);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe
};
