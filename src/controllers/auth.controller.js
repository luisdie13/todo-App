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
        error: 'Email and password are required' 
      });
    }

    // Llamar al servicio de autenticación
    const result = await authService.register(email, password, req);

    // Retornar usuario y tokens
    return res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });

  } catch (err) {
    console.error('Error in register:', err.message);

    // Manejar errores específicos
    if (err.message === 'Email is already registered') {
      return res.status(409).json({ 
        error: 'Email is already registered' 
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
        error: 'Email and password are required' 
      });
    }

    // Llamar al servicio de autenticación
    const result = await authService.login(email, password, req);

    // Inyectar refreshToken en cookie segura HttpOnly
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

     // Retornar usuario y accessToken (el refreshToken está en la cookie)
     // CRÍTICO: Incluir SIEMPRE id y _id explícitamente para evitar mapeos inconsistentes
     return res.status(200).json({
       message: 'Session started successfully',
       user: {
         id: result.user._id,
         _id: result.user._id,
         email: result.user.email,
         role: result.user.role
       },
       accessToken: result.accessToken
     });

   } catch (err) {
     console.error('Error in login:', err.message);

     // Registrar intento fallido si no se registró en el servicio
     if (err.message === 'Invalid credentials') {
       return res.status(401).json({ 
         error: 'Invalid credentials' 
       });
     }

     // Manejar cuenta inactiva
     if (err.message === 'User account is inactive') {
       return res.status(403).json({ 
         error: 'User account is inactive' 
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
    // Validación estricta: verificar que existan cookies y el refresh token
    if (!req.cookies || !req.cookies.refreshToken) {
      console.warn('Refresh attempt without active session or missing token');
      return res.status(401).json({ 
        error: 'No active session or refresh token missing' 
      });
    }

    const refreshToken = req.cookies.refreshToken;

    // Intentar refrescar el token con manejo robusto de errores
    try {
      const tokenService = require('../services/tokenService');
      const tokens = tokenService.refreshAccessToken(refreshToken);

      // Volver a emitir la cookie actualizada
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
      });

       return res.status(200).json({
         message: 'Token refreshed successfully',
         accessToken: tokens.accessToken,
         refreshToken: tokens.refreshToken
       });

    } catch (tokenError) {
      console.error('Error in silent refresh:', tokenError.message);
      
      // Retornar 401 en lugar de 500 para errores de token
      return res.status(401).json({ 
        error: 'Invalid token or expired session' 
      });
    }

  } catch (err) {
    console.error('Error in refresh (controller):', err.message);
    // Para cualquier otro error inesperado, también retornar 401
    return res.status(401).json({ 
      error: 'Could not refresh session' 
    });
  }
};

/**
 * POST /api/auth/logout
 * Cierra la sesión del usuario
 */
const logout = async (req, res, next) => {
  try {
    // Leer refreshToken de cookies o body (con optional chaining)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token is required' 
      });
    }

    const tokenService = require('../services/tokenService');
    tokenService.revokeRefreshToken(refreshToken);

    // Limpiar la cookie del navegador
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    // Registrar evento de logout
    const email = req.body?.email || 'unknown';
    await auditLogService.log('auth.logout', req, {
      email,
      statusCode: 200,
      details: 'Successful logout'
    });

    return res.status(200).json({ 
      message: 'Session closed successfully' 
    });

  } catch (err) {
    console.error('Error in logout:', err.message);
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
        error: 'Not authenticated' 
      });
    }

    // CRÍTICO: Unificar IDs explícitamente
    // req.user.id viene del JWT, pero necesitamos también _id para consistencia en el frontend
    return res.status(200).json({
      user: {
        id: req.user.id,
        _id: req.user.id,  // Asegurar que _id siempre está presente
        email: req.user.email,
        role: req.user.role
      }
    });

  } catch (err) {
    console.error('Error in getMe:', err.message);
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
