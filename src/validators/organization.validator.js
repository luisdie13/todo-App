const Joi = require('joi');

const createOrgSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 3 caracteres',
      'string.max': 'El nombre no puede exceder 100 caracteres',
      'any.required': 'El nombre es requerido'
    }),
  description: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'La descripción no puede exceder 500 caracteres'
    })
});

const updateOrgSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .optional()
    .messages({
      'string.min': 'El nombre debe tener al menos 3 caracteres',
      'string.max': 'El nombre no puede exceder 100 caracteres'
    }),
  description: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'La descripción no puede exceder 500 caracteres'
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
  role: Joi.string()
    .valid('member', 'org_admin')
    .default('member')
    .messages({
      'any.only': 'El rol debe ser: member u org_admin'
    })
});

module.exports = {
  createOrgSchema,
  updateOrgSchema,
  inviteSchema
};
