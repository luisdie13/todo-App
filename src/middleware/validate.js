/**
 * Middleware genérico para validar req.body contra un esquema JOI
 * @param {Joi.Schema} schema - El esquema de validación de JOI
 * @returns {Function} Middleware de Express
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      // Extraer los mensajes de error
      const messages = error.details.map(detail => detail.message).join(', ');
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: messages
      });
    }

    // Reemplazar req.body con los valores validados
    req.body = value;
    next();
  };
};

module.exports = validate;
