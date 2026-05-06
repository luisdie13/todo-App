const rateLimit = require('express-rate-limit');

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
    const ip = req.ip;
    const email = req.body?.email || '';
    return `${ip}-${email}`;
  },
  handler: (req, res) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000);
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
    const ip = req.ip;
    const email = req.body?.email || '';
    return `${ip}-${email}`;
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
    const ip = req.ip;
    return userId ? `user-${userId}` : `ip-${ip}`;
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
