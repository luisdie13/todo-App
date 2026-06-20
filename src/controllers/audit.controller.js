const AuditLog = require('../models/auditLog.model');
const auditLogService = require('../services/auditLog.service');

/**
 * GET /api/audit/logs
 * Obtiene todos los logs de auditoría (SOLO SUPER_ADMIN)
 */
const getAllLogs = async (req, res, next) => {
  try {
    const { limit = 50, evento, email, ip } = req.query;

     // Only super_admin can view logs
      if (req.user.role !== 'super_admin') {
        await auditLogService.logTaskEvent('access.denied', req, {
         action: 'GET',
         resource: 'audit.logs',
         reason: 'User is not super_admin'
       });
       return res.status(403).json({ error: 'Only super_admin can access audit logs' });
     }

    let query = {};

    // Filtros opcionales
    if (evento) {
      query.evento = evento;
    }
    if (email) {
      query.email = email.toLowerCase();
    }
    if (ip) {
      query.ip = ip;
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Registrar acceso a logs
    await auditLogService.logTaskEvent('audit.logs_viewed', req, {
      logsCount: logs.length,
      filters: { evento, email, ip }
    });

    return res.status(200).json({
      success: true,
      logs,
      total: logs.length
    });

  } catch (err) {
    console.error('Error al obtener logs de auditoría:', err);
    next(err);
  }
};

/**
 * GET /api/audit/logs/event/:evento
 * Obtiene logs por evento específico (SOLO SUPER_ADMIN)
 */
const getLogsByEvent = async (req, res, next) => {
  try {
    const { evento } = req.params;
    const { limit = 50 } = req.query;

    // Only super_admin can view logs
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can access audit logs' });
    }

    const logs = await AuditLog.find({ evento })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Registrar acceso
    await auditLogService.logTaskEvent('audit.logs_viewed', req, {
      evento,
      logsCount: logs.length
    });

    return res.status(200).json({
      success: true,
      evento,
      logs,
      total: logs.length
    });

  } catch (err) {
    console.error('Error al obtener logs por evento:', err);
    next(err);
  }
};

/**
 * GET /api/audit/logs/user/:userId
 * Obtiene logs de un usuario específico (SOLO SUPER_ADMIN)
 */
const getLogsByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    // Only super_admin can view logs
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can access audit logs' });
    }

    const logs = await AuditLog.find({ userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Registrar acceso
    await auditLogService.logTaskEvent('audit.logs_viewed', req, {
      targetUserId: userId,
      logsCount: logs.length
    });

    return res.status(200).json({
      success: true,
      userId,
      logs,
      total: logs.length
    });

  } catch (err) {
    console.error('Error al obtener logs por usuario:', err);
    next(err);
  }
};

/**
 * GET /api/audit/logs/ip/:ip
 * Obtiene logs por dirección IP (SOLO SUPER_ADMIN)
 */
const getLogsByIP = async (req, res, next) => {
  try {
    const { ip } = req.params;
    const { limit = 50 } = req.query;

    // Only super_admin can view logs
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can access audit logs' });
    }

    const logs = await AuditLog.find({ ip })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Register access
    await auditLogService.logTaskEvent('audit.logs_viewed', req, {
      ip,
      logsCount: logs.length
    });

    return res.status(200).json({
      success: true,
      ip,
      logs,
      total: logs.length
    });

  } catch (err) {
    console.error('Error getting logs by IP:', err);
    next(err);
  }
};

/**
 * GET /api/audit/logs/email/:email
 * Gets logs by email (SUPER_ADMIN ONLY)
 */
const getLogsByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const { limit = 50 } = req.query;

    // Only super_admin can view logs
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can access audit logs' });
    }

    const logs = await AuditLog.find({ email: email.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Register access
    await auditLogService.logTaskEvent('audit.logs_viewed', req, {
      email,
      logsCount: logs.length
    });

    return res.status(200).json({
      success: true,
      email,
      logs,
      total: logs.length
    });

  } catch (err) {
    console.error('Error getting logs by email:', err);
    next(err);
  }
};

/**
 * GET /api/audit/stats
 * Gets audit statistics (SUPER_ADMIN ONLY)
 */
const getAuditStats = async (req, res, next) => {
  try {
    // Only super_admin can view statistics
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super_admin can access audit statistics' });
    }

    // Contar eventos por tipo
    const eventStats = await AuditLog.aggregate([
      {
        $group: {
          _id: '$evento',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Contar intentos fallidos
    const failedLogins = await AuditLog.countDocuments({
      evento: 'auth.login.failure'
    });

    // Total de logs
    const totalLogs = await AuditLog.countDocuments();

    // Logs en las últimas 24 horas
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logsLast24Hours = await AuditLog.countDocuments({
      timestamp: { $gte: last24Hours }
    });

    // Registrar acceso
    await auditLogService.logTaskEvent('audit.stats_viewed', req, {
      totalLogs
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalLogs,
        logsLast24Hours,
        failedLogins,
        eventStats
      }
    });

  } catch (err) {
    console.error('Error al obtener estadísticas de auditoría:', err);
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
