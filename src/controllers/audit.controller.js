const AuditLog = require('../models/auditLog.model');
const auditLogService = require('../services/auditLog.service');

/**
 * GET /api/audit/logs
 * Obtiene todos los logs de auditoría (SOLO SUPER_ADMIN)
 */
const getAllLogs = async (req, res, next) => {
  try {
    const { limit = 50, evento, email, ip } = req.query;

    // Solo super_admin puede ver logs
    if (req.usuario.rol !== 'super_admin') {
      await auditLogService.logTaskEvent('access.denied', req, {
        action: 'GET',
        recurso: 'audit.logs',
        reason: 'Usuario no es super_admin'
      });
      return res.status(403).json({ error: 'Solo super_admin puede acceder a los logs de auditoría' });
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

    // Solo super_admin puede ver logs
    if (req.usuario.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede acceder a los logs de auditoría' });
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

    // Solo super_admin puede ver logs
    if (req.usuario.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede acceder a los logs de auditoría' });
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

    // Solo super_admin puede ver logs
    if (req.usuario.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede acceder a los logs de auditoría' });
    }

    const logs = await AuditLog.find({ ip })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Registrar acceso
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
    console.error('Error al obtener logs por IP:', err);
    next(err);
  }
};

/**
 * GET /api/audit/logs/email/:email
 * Obtiene logs por email (SOLO SUPER_ADMIN)
 */
const getLogsByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const { limit = 50 } = req.query;

    // Solo super_admin puede ver logs
    if (req.usuario.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede acceder a los logs de auditoría' });
    }

    const logs = await AuditLog.find({ email: email.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    // Registrar acceso
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
    console.error('Error al obtener logs por email:', err);
    next(err);
  }
};

/**
 * GET /api/audit/stats
 * Obtiene estadísticas de auditoría (SOLO SUPER_ADMIN)
 */
const getAuditStats = async (req, res, next) => {
  try {
    // Solo super_admin puede ver estadísticas
    if (req.usuario.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede acceder a las estadísticas de auditoría' });
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
