/**
 * Middleware genérico para validar req.body contra un esquema JOI.
 * Incluye lógica de saneamiento de datos y reportes de error detallados.
 * * @param {Joi.Schema} schema - El esquema de validación de JOI.
 * @returns {Function} Middleware de Express.
 */
const validate = (schema) => {
  return (req, res, next) => {
    // 1. Registro de inspección de carga útil (Payload)
    console.log("--- Validación de Middleware iniciada ---");
    console.log("Ruta:", req.originalUrl);
    console.log("Cuerpo recibido:", JSON.stringify(req.body, null, 2));

    // 2. Validación estricta con Joi
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,    // Reporta todos los errores encontrados, no solo el primero
      stripUnknown: true,   // Elimina campos que no están definidos en el esquema
      allowUnknown: false   // Falla si se envían campos desconocidos (más seguro para evitar inyecciones)
    });

    if (error) {
      // 3. Mapeo de errores para lectura humana
      const errorDetails = error.details.map(detail => detail.message);
      
      console.error("❌ Validación fallida en:", req.originalUrl);
      console.error("Detalle técnico del error:", errorDetails);
      
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: errorDetails.join(' | ')
      });
    }

    // 4. Inyección de valores saneados al ciclo de vida de la petición
    req.body = value;
    console.log("✅ Validación exitosa. Datos saneados:", JSON.stringify(req.body, null, 2));
    next();
  };
};

module.exports = validate;