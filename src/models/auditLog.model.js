const mongoose = require('mongoose');

/**
 * AuditLog Schema — records all security and operational events.
 * 
 * Security properties:
 *   - Records CANNOT be deleted (permanent deletion lock via pre-hooks)
 *   - Compound indexes enable fast lookups by IP, email, event type, and time
 *   - Field names use Spanish (legacy) but are transformed to English in API responses
 */
const auditLogSchema = new mongoose.Schema({
  evento: {
    type: String,
    enum: [
      // ── Authentication events ──────────────────────────────────────────
      'auth.register',
      'auth.login.success',
      'auth.login.failure',
      'auth.logout',

      // ── Security / access events ───────────────────────────────────────
      'security.unauthorized',
      'security.rate_limited',
      'access.denied',

      // ── Task lifecycle events ──────────────────────────────────────────
      'task.created',
      'task.updated',
      'task.deleted',
      'task.marked_done',
      'task.unauthorized_access',
      'task.unauthorized_deletion',

      // ── Project lifecycle events ───────────────────────────────────────
      'project.created',
      'project.updated',
      'project.deleted',
      'project.archived',
      'project.unarchived',

      // ── Audit-access events ────────────────────────────────────────────
      'audit.logs_viewed',
      'audit.stats_viewed',

      // ── User management events (super_admin actions) ───────────────────
      'user.activated',
      'user.deactivated'
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
  timestamps: false,   // 'timestamp' field above serves the same purpose
  collection: 'auditLogs'
});

// ── Compound indexes for the most frequent query patterns ──────────────────────
auditLogSchema.index({ ip: 1, timestamp: -1 });
auditLogSchema.index({ email: 1, timestamp: -1 });
auditLogSchema.index({ evento: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// ── Permanent deletion lock ────────────────────────────────────────────────────
auditLogSchema.pre('deleteOne', function (next) {
  const error = new Error('Deletion of audit log records is not permitted');
  error.name = 'AuditLogDeletionError';
  next(error);
});

auditLogSchema.pre('deleteMany', function (next) {
  const error = new Error('Deletion of audit log records is not permitted');
  error.name = 'AuditLogDeletionError';
  next(error);
});

auditLogSchema.pre('findByIdAndDelete', function (next) {
  const error = new Error('Deletion of audit log records is not permitted');
  error.name = 'AuditLogDeletionError';
  next(error);
});

/**
 * Static helper — creates and persists an audit log entry.
 * Never throws; errors are swallowed to prevent disrupting the primary request flow.
 */
auditLogSchema.statics.registrarEvento = async function (
  evento,
  ip,
  userAgent,
  email    = null,
  detalles = null,
  statusCode = null,
  userId   = null
) {
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
    console.error('[AuditLog] Error persisting audit event:', err.message);
    return null;   // Swallow — audit failures must NOT break business logic
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
