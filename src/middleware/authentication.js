const tokenService = require('../services/tokenService');

/**
 * Middleware de autenticación
 * Valida que el JWT sea válido y extrae la información del usuario
 */
const authentication = (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.get('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        error: 'No autenticado - Token requerido'
      });
    }

    // Extraer el token del formato "Bearer TOKEN"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Formato de Authorization inválido'
      });
    }

    const token = parts[1];

    // Validar el token
    const decoded = tokenService.verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Token inválido'
      });
    }

    // Agregar la información del usuario al request
    req.user = decoded;
    next();

  } catch (err) {
    console.error('Error en autenticación:', err.message);

    // Diferenciar entre token expirado y token inválido
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido'
      });
    }

    return res.status(401).json({
      error: 'No autenticado'
    });
  }
};

/**
 * Middleware de autenticación opcional
 * Intenta validar el token pero no falla si no existe
 */
const authenticationOptional = (req, res, next) => {
  try {
    const authHeader = req.get('Authorization');

    if (!authHeader) {
      return next(); // Continuar sin autenticación
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next(); // Continuar sin autenticación
    }

    const token = parts[1];
    const decoded = tokenService.verifyAccessToken(token);

    if (decoded) {
      req.user = decoded;
    }

    next();

  } catch (err) {
    // Ignorar errores de autenticación opcional y continuar
    next();
  }
};

module.exports = {
  authentication,
  authenticationOptional
};
