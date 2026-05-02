const Joi = require('joi');

// Esquema para registro
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email debe ser válido',
      'any.required': 'Email es requerido'
    }),
  password: Joi.string()
    .required()
    .min(6)
    .messages({
      'string.min': 'Password debe tener al menos 6 caracteres',
      'any.required': 'Password es requerido'
    })
});

// Esquema para login
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email debe ser válido',
      'any.required': 'Email es requerido'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password es requerido'
    })
});

module.exports = {
  registerSchema,
  loginSchema
};
