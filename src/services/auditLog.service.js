const AuditLog = require('../models/auditLog.model');

/**
 * Centralized Audit Log Service
 * Provides safe logging helpers that absorb internal errors so audit failures
 * never interrupt the primary application request flow.
 */

// ── Complete list of valid events (must stay in sync with auditLog.model.js enum) ──
const VALID_EVENTS = new Set([
  // Authentication
  'auth.register',
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  // Security / access
  'security.unauthorized',
  'security.rate_limited',
  'access.denied',
  // Task lifecycle
  'task.created',
  'task.updated',
  'task.deleted',
  'task.marked_done',
  'task.unauthorized_access',
  'task.unauthorized_deletion',
  // Project lifecycle
  'project.created',
  'project.updated',
  'project.deleted',
  'project.archived',
  'project.unarchived',
  // Audit access
  'audit.logs_viewed',
  'audit.stats_viewed',
  // User management
  'user.activated',
  'user.deactivated'
]);

// ── Internal helper ────────────────────────────────────────────────────────────
const _extractRequestMeta = (req) => ({
  ip:        req.ip || req.connection?.remoteAddress || 'unknown',
  userAgent: req.get('user-agent') || 'unknown',
  userId:    req.user?.id || null
});

// ══════════════════════════════════════════════════════════════════════════════
// log()
// Generic low-level logger — used primarily by auth and security events.
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Records a generic audit event.
 *
 * @param {string} evento       - Event type key (must exist in VALID_EVENTS)
 * @param {Object} req          - Express request object
 * @param {Object} [options]
 * @param {string} [options.email]      - Email of the subject user
 * @param {string} [options.userId]     - ID of the subject user
 * @param {string} [options.detalles]   - Free-text details / payload
 * @param {number} [options.statusCode] - HTTP status code of the response
 * @returns {Promise<Object|null>}
 */
const log = async (evento, req, options = {}) => {
  try {
    if (!VALID_EVENTS.has(evento)) {
      console.warn(`[AuditLog] Unknown event type ignored: "${evento}"`);
      return null;
    }

    const { ip, userAgent } = _extractRequestMeta(req);
    const { email = null, userId = null, detalles = null, statusCode = null } = options;

    const auditLog = await AuditLog.registrarEvento(
      evento, ip, userAgent, email, detalles, statusCode, userId
    );

    console.log(
      `[AUDIT] ${evento} | IP: ${ip} | Email: ${email ?? '-'} | ${new Date().toISOString()}`
    );

    return auditLog;
  } catch (err) {
    console.error('[AuditLog] Unexpected error in log():', err.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// logTaskEvent()
// Structured logger for task-related events.
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Records a task-related audit event with structured payload.
 *
 * @param {string} evento   - Task event type
 * @param {Object} req      - Express request object
 * @param {Object} [options]
 * @param {string} [options.taskId]
 * @param {string} [options.projectId]
 * @param {string} [options.taskTitle]
 * @param {string} [options.action]
 * @param {string} [options.reason]
 * @returns {Promise<Object|null>}
 */
const logTaskEvent = async (evento, req, options = {}) => {
  try {
    if (!VALID_EVENTS.has(evento)) {
      console.warn(`[AuditLog] Unknown event type ignored: "${evento}"`);
      return null;
    }

    const { ip, userAgent, userId } = _extractRequestMeta(req);
    const { taskId, projectId, taskTitle, action, reason, logsCount, filters } = options;

    let detalles = `Event: ${evento}`;
    if (taskId)     detalles += ` | Task ID: ${taskId}`;
    if (projectId)  detalles += ` | Project ID: ${projectId}`;
    if (taskTitle)  detalles += ` | Title: "${taskTitle}"`;
    if (action)     detalles += ` | Action: ${action}`;
    if (reason)     detalles += ` | Reason: ${reason}`;
    if (logsCount !== undefined) detalles += ` | Records returned: ${logsCount}`;
    if (filters)    detalles += ` | Filters: ${JSON.stringify(filters)}`;

    const auditLog = await AuditLog.registrarEvento(
      evento, ip, userAgent, null, detalles, null, userId
    );

    console.log(`[AUDIT TASK] ${evento} | User: ${userId ?? '-'} | IP: ${ip} | ${detalles}`);

    return auditLog;
  } catch (err) {
    console.error('[AuditLog] Unexpected error in logTaskEvent():', err.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// logUserEvent()
// Structured logger for user management events performed by super_admin.
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Records a user management event (activate / deactivate) performed by super_admin.
 *
 * @param {string} evento   - Must be 'user.activated' or 'user.deactivated'
 * @param {Object} req      - Express request object (req.user = operator / super_admin)
 * @param {Object} [options]
 * @param {string} [options.targetUserId]    - ID of the user being modified
 * @param {string} [options.targetUserEmail] - Email of the user being modified
 * @param {boolean} [options.newStatus]      - New isActive value after the operation
 * @returns {Promise<Object|null>}
 */
const logUserEvent = async (evento, req, options = {}) => {
  try {
    if (!VALID_EVENTS.has(evento)) {
      console.warn(`[AuditLog] Unknown event type ignored: "${evento}"`);
      return null;
    }

    const { ip, userAgent, userId: operatorId } = _extractRequestMeta(req);
    const { targetUserId, targetUserEmail, newStatus } = options;

    let detalles = `Event: ${evento}`;
    if (operatorId)       detalles += ` | Operator ID: ${operatorId}`;
    if (targetUserId)     detalles += ` | Target User ID: ${targetUserId}`;
    if (targetUserEmail)  detalles += ` | Target Email: ${targetUserEmail}`;
    if (newStatus !== undefined) {
      detalles += ` | New Status: ${newStatus ? 'active' : 'inactive'}`;
    }

    const auditLog = await AuditLog.registrarEvento(
      evento, ip, userAgent, targetUserEmail ?? null, detalles, null, operatorId
    );

    console.log(
      `[AUDIT USER MGMT] ${evento} | Operator: ${operatorId ?? '-'} | Target: ${targetUserEmail ?? targetUserId ?? '-'} | IP: ${ip}`
    );

    return auditLog;
  } catch (err) {
    console.error('[AuditLog] Unexpected error in logUserEvent():', err.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Read helpers (used by audit.controller.js)
// ══════════════════════════════════════════════════════════════════════════════

/** Returns the N most recent audit log entries. */
const obtenerUltimos = async (limit = 10) => {
  try {
    return await AuditLog.find().sort({ timestamp: -1 }).limit(limit).lean();
  } catch (err) {
    console.error('[AuditLog] Error fetching recent logs:', err.message);
    return [];
  }
};

/** Returns audit logs filtered by event type. */
const obtenerPorEvento = async (evento, limit = 10) => {
  try {
    return await AuditLog.find({ evento }).sort({ timestamp: -1 }).limit(limit).lean();
  } catch (err) {
    console.error(`[AuditLog] Error fetching logs for event "${evento}":`, err.message);
    return [];
  }
};

/** Returns audit logs filtered by originating IP address. */
const obtenerPorIP = async (ip, limit = 10) => {
  try {
    return await AuditLog.find({ ip }).sort({ timestamp: -1 }).limit(limit).lean();
  } catch (err) {
    console.error(`[AuditLog] Error fetching logs for IP "${ip}":`, err.message);
    return [];
  }
};

/** Returns audit logs filtered by email address. */
const obtenerPorEmail = async (email, limit = 10) => {
  try {
    return await AuditLog.find({ email: email.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error(`[AuditLog] Error fetching logs for email "${email}":`, err.message);
    return [];
  }
};

module.exports = {
  log,
  logTaskEvent,
  logUserEvent,
  obtenerUltimos,
  obtenerPorEvento,
  obtenerPorIP,
  obtenerPorEmail
};
