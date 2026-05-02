/**
 * Middleware centralizado para manejo de errores
 * Registra los errores en el servidor y responde genéricamente al cliente
 */
const errorHandler = (err, req, res, next) => {
  // Registrar el error en el servidor (console.error o logger)
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  // Validar si es un error de MongoDB (ID inválido)
  if (err.name === 'CastError' || (err.kind === 'ObjectId')) {
    return res.status(400).json({
      error: 'Invalid request'
    });
  }

  // Validar si es un error de validación de Mongoose
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: err.message
    });
  }

  // Errores genéricos - no revelar stack trace al cliente
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(statusCode).json({
    error: 'Internal Server Error',
    ...(isProduction ? {} : { message: err.message })
  });
};

module.exports = errorHandler;
