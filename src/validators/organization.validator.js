const Joi = require('joi');

const createOrgSchema = Joi.object({
  nombre: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 3 caracteres',
      'string.max': 'El nombre no puede exceder 100 caracteres',
      'any.required': 'El nombre es requerido'
    }),
  descripcion: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'La descripción no puede exceder 500 caracteres'
    })
});

const updateOrgSchema = Joi.object({
  nombre: Joi.string()
    .min(3)
    .max(100)
    .optional()
    .messages({
      'string.min': 'El nombre debe tener al menos 3 caracteres',
      'string.max': 'El nombre no puede exceder 100 caracteres'
    }),
  descripcion: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'La descripción no puede exceder 500 caracteres'
    }),
  estado: Joi.string()
    .valid('activa', 'inactiva', 'suspendida')
    .optional()
    .messages({
      'any.only': 'El estado debe ser: activa, inactiva o suspendida'
    })
});

const inviteSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'El email debe ser válido',
      'any.required': 'El email es requerido'
    }),
  rol: Joi.string()
    .valid('admin', 'miembro', 'visualizador')
    .default('miembro')
    .messages({
      'any.only': 'El rol debe ser: admin, miembro o visualizador'
    })
});

module.exports = {
  createOrgSchema,
  updateOrgSchema,
  inviteSchema
};
