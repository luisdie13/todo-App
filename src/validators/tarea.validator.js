const Joi = require('joi');

// Esquema para POST (crear tarea)
const createTareaSchema = Joi.object({
  title: Joi.string()
    .required()
    .trim()
    .min(1)
    .messages({
      'string.empty': 'Title no puede estar vacío',
      'any.required': 'Title es requerido'
    }),
  completed: Joi.boolean().default(false)
});

// Esquema para PUT (actualizar tarea)
const updateTareaSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(1)
    .messages({
      'string.empty': 'Title no puede estar vacío'
    }),
  completed: Joi.boolean()
}).min(1);

module.exports = {
  createTareaSchema,
  updateTareaSchema
};
