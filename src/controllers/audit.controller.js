const AuditLog = require('../models/auditLog.model');
const auditLogService = require('../services/auditLog.service');

/**
 * audit.controller.js — Administrative Audit Logging Controller Engine.
 *
 * Requirements Met:
 * - Enforces absolute server-side RBAC boundaries for super_admin.
 * - Implements strict data structure pagination compatible with frontend grids.
 * - Aligns database search queries to unversioned English fields schema ('action', 'operator').
 */

/**
 * GET /api/admin/audit-logs
 * Retrieves a filterable, paginated registry block of all immutable platform event trails.
 */
const getAllLogs = async (req, res, next) => {
  try {
    // Only super_admin holds structural clearance to read audit databases
    if (req.user?.role !== 'super_admin') {
      await auditLogService.logTaskEvent('security.unauthorized', req, {
        action: 'GET',
        resource: 'admin.audit-logs',
        reason: 'Unauthorized non-admin actor tried accessing structural log ledger entries.'
      });
      return res.status(403).json({ error: 'Access Denied: Administrative clearance required.' });
    }

    // Force explicit typecasting and sanitization to prevent NoSQL Injection attacks
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const { event, email, ip } = req.query;
    let databaseQuery = {};

    // Compliance Check: Maps attributes parameters strictly to English schema fields rules
    if (event) {
      databaseQuery.action = String(event).trim();
    }
    if (email) {
      // Handles email lookups query matching polimorphic nested paths safely
      databaseQuery.$or = [
        { 'operator.email': String(email).toLowerCase().trim() },
        { email: String(email).toLowerCase().trim() }
      ];
    }
    if (ip) {
      databaseQuery.ip = String(ip).trim();
    }

    // Execute concurrent pipeline calculations to compute accurate paginated documents counts
    const [logs, totalDocs] = await Promise.all([
      AuditLog.find(databaseQuery)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(databaseQuery)
    ]);

    const totalPages = Math.ceil(totalDocs / limit);

    return res.status(200).json({
      success: true,
      docs: logs, // Maps list cleanly to frontend response parser tracking parameters
      page,
      limit,
      totalPages,
      totalDocs
    });

  } catch (err) {
    console.error('[AuditController] Global log lookup pipeline execution failed:', err);
    next(err);
  }
};

/**
 * GET /api/admin/audit-logs/event/:event
 * Fetches log history explicitly bound to a unique action event token string signature.
 */
const getLogsByEvent = async (req, res, next) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Administrative clearance required.' });
    }

    const targetEvent = String(req.params.event || req.params.evento).trim();
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);

    const logs = await AuditLog.find({ action: targetEvent })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      event: targetEvent,
      docs: logs,
      total: logs.length
    });

  } catch (err) {
    console.error('[AuditController] Failed to query records by event identifier:', err);
    next(err);
  }
};

/**
 * GET /api/admin/audit-logs/user/:userId
 */
const getLogsByUser = async (req, res, next) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Administrative clearance required.' });
    }

    const { userId } = req.params;
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);

    const logs = await AuditLog.find({ 
      $or: [
        { actorId: userId },
        { userId: userId }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      userId,
      docs: logs,
      total: logs.length
    });

  } catch (err) {
    console.error('[AuditController] Failed to isolate logs by active actor object reference:', err);
    next(err);
  }
};

/**
 * GET /api/admin/audit-logs/ip/:ip
 */
const getLogsByIP = async (req, res, next) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Administrative clearance required.' });
    }

    const targetIP = String(req.params.ip).trim();
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);

    const logs = await AuditLog.find({ ip: targetIP })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      ip: targetIP,
      docs: logs,
      total: logs.length
    });

  } catch (err) {
    console.error('[AuditController] Failed to locate records matching gateway network parameter IP:', err);
    next(err);
  }
};

/**
 * GET /api/admin/audit-logs/email/:email
 */
const getLogsByEmail = async (req, res, next) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Administrative clearance required.' });
    }

    const targetEmail = String(req.params.email).toLowerCase().trim();
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);

    const logs = await AuditLog.find({
      $or: [
        { 'operator.email': targetEmail },
        { email: targetEmail }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      email: targetEmail,
      docs: logs,
      total: logs.length
    });

  } catch (err) {
    console.error('[AuditController] Error querying records by actor identifier string email:', err);
    next(err);
  }
};

/**
 * GET /api/admin/audit-stats
 * Computes high-value aggregation analytical datasets from event collections.
 */
const getAuditStats = async (req, res, next) => {
  try {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access Denied: Administrative analytical clearance required.' });
    }

    // Dynamic database aggregation calculating action event calls density weights
    const eventStatsPipeline = await AuditLog.aggregate([
      {
        $group: {
          _id: '$action', // Aligned cleanly to mapped document schemas
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          event: '$_id',
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Concurrently compute absolute volumes metrics
    const [failedLogins, totalLogs, logsLast24Hours] = await Promise.all([
      AuditLog.countDocuments({ action: 'auth.login.failure' }),
      AuditLog.countDocuments(),
      AuditLog.countDocuments({
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalLogs,
        logsLast24Hours,
        failedLogins,
        eventStats: eventStatsPipeline
      }
    });

  } catch (err) {
    console.error('[AuditController] Analytical data computation stream aborted:', err);
    next(err);
  }
};

module.exports = {
  getAllLogs,
  getLogsByEvent,
  getLogsByUser,
  getLogsByIP,
  getLogsByEmail,
  getAuditStats
};