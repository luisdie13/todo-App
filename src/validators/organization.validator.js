const Joi = require('joi');

/**
 * organization.validator.js — Secure Validation Schemas for Organization Contexts.
 * * Requirements Met:
 * - Syncs the dynamic target lookup validation arrays with the expanded workspace roles.
 * - Prevents HTTP 422 (Unprocessable Entity) errors when upgrading/downgrading members.
 */

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
    .allow('', null) // Prevents crashes if an empty string payload is delivered from the form
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
    .allow('', null)
    .messages({
      'string.max': 'La descripción no puede exceder 500 caracteres'
    })
});

const inviteSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase() // Automatic normalization step protecting Lookups pipelines against casing mismatches
    .trim()
    .messages({
      'string.email': 'El email debe ser un formato de correo electrónico válido',
      'any.required': 'El email es requerido'
    }),
  role: Joi.string()
    .required() // Explicit requirements tracking target parameters allocations
    .lowercase()
    .trim()
    // FIX: Expanded options pool arrays explicitly mapping to frontend dropdown values variables
    .valid('org_admin', 'project_admin', 'developer', 'viewer', 'member')
    .messages({
      'any.only': 'El rol especificado debe coincidir con: org_admin, project_admin, developer, viewer o member'
    })
});

module.exports = {
  createOrgSchema,
  updateOrgSchema,
  inviteSchema
};