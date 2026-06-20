const mongoose = require('mongoose');

/**
 * Schema de AuditLog para registrar eventos de seguridad
 * - Registra intentos de login, logout, registro, errores de autorización, rate limiting
 * - Los registros NO PUEDEN ser borrados (bloqueo permanente)
 * - Incluye índices para búsquedas rápidas
 */
const auditLogSchema = new mongoose.Schema({
  evento: {
    type: String,
    enum: [
      'auth.register',
      'auth.login.success',
      'auth.login.failure',
      'auth.logout',
      'security.unauthorized',
      'security.rate_limited',
      'task.created',
      'task.updated',
      'task.deleted',
      'task.unauthorized_access'
    ],
    required: true,
    index: true
  },
  ip: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  email: {
    type: String,
    lowercase: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  detalles: {
    type: String,
    default: null
  },
  statusCode: {
    type: Number,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false, // No usar createdAt/updatedAt adicionales
  collection: 'auditLogs'
});

/**
 * Índices compuestos para búsquedas frecuentes
 */
auditLogSchema.index({ ip: 1, timestamp: -1 });
auditLogSchema.index({ email: 1, timestamp: -1 });
auditLogSchema.index({ evento: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

/**
 * BLOQUEO DE BORRADO: Prevenir que se eliminen registros de auditoría
 * - deleteOne() fallará
 * - deleteMany() fallará
 * - findByIdAndDelete() fallará
 */
auditLogSchema.pre('deleteOne', function(next) {
  const error = new Error('No está permitido eliminar registros de auditoría');
  error.name = 'AuditLogDeletionError';
  next(error);
});

auditLogSchema.pre('deleteMany', function(next) {
  const error = new Error('No está permitido eliminar registros de auditoría');
  error.name = 'AuditLogDeletionError';
  next(error);
});

auditLogSchema.pre('findByIdAndDelete', function(next) {
  const error = new Error('No está permitido eliminar registros de auditoría');
  error.name = 'AuditLogDeletionError';
  next(error);
});

/**
 * Método para registrar eventos de forma segura
 */
auditLogSchema.statics.registrarEvento = async function(evento, ip, userAgent, email = null, detalles = null, statusCode = null, userId = null) {
  try {
    const log = new this({
      evento,
      ip,
      userAgent,
      email,
      userId,
      detalles,
      statusCode,
      timestamp: new Date()
    });
    
    await log.save();
    return log;
  } catch (err) {
    console.error('Error al registrar evento de auditoría:', err);
    // No re-lanzar el error para no interrumpir el flujo principal
    return null;
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
