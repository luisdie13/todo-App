const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const auditLogService = require('../services/auditLog.service');

/**
 * Rate limiter para el endpoint de LOGIN
 * - 5 intentos máximo
 * - En una ventana de 15 minutos (900 segundos)
 * - Validado por IP + Email
 */
const rateLimitLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos máximo
  keyGenerator: (req) => {
    // Llave combinada de IP + Email para mayor precisión
    const ipKey = ipKeyGenerator(req);
    const email = req.body?.email || '';
    return `${ipKey}-${email}`;
  },
  handler: async (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000);
    
    // Registrar evento de rate limiting
    await auditLogService.log('security.rate_limited', req, {
      email: req.body?.email,
      statusCode: 429,
      detalles: 'Demasiados intentos de login'
    });
    
    res.set('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Demasiados intentos de login. Por favor, intenta de nuevo más tarde.',
      retryAfter: retryAfter
    });
  },
  skip: (req) => {
    // No aplicar rate limit a peticiones sin email
    return !req.body || !req.body.email;
  }
});

/**
 * Rate limiter para el endpoint de REGISTRO
 * - 3 intentos máximo
 * - En una ventana de 1 hora (3600 segundos)
 * - Validado por IP + Email
 */
const rateLimitRegister = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos máximo
  keyGenerator: (req) => {
    // Llave combinada de IP + Email
    const ipKey = ipKeyGenerator(req);
    const email = req.body?.email || '';
    return `${ipKey}-${email}`;
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000);
    res.set('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Demasiados intentos de registro desde esta dirección. Por favor, intenta de nuevo más tarde.',
      retryAfter: retryAfter
    });
  },
  skip: (req) => {
    // No aplicar rate limit a peticiones sin email
    return !req.body || !req.body.email;
  }
});

/**
 * Rate limiter general para endpoints autenticados
 * - 100 intentos máximo
 * - En una ventana de 1 minuto (60 segundos)
 * - Validado por Usuario ID
 */
const rateLimitGeneral = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 intentos máximo
  keyGenerator: (req) => {
    // Usar el user ID si está autenticado, sino usar IP
    const userId = req.user?.id;
    const ipKey = ipKeyGenerator(req);
    return userId ? `user-${userId}` : ipKey;
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000);
    res.set('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Demasiadas peticiones. Por favor, intenta de nuevo más tarde.',
      retryAfter: retryAfter
    });
  }
});

module.exports = {
  rateLimitLogin,
  rateLimitRegister,
  rateLimitGeneral
};
