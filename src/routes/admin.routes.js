const express = require('express');
const mongoose = require('mongoose');
const { authentication }  = require('../middleware/authentication');
const { authorize }       = require('../middleware/authorization');
const User                = require('../models/user.model');
const AuditLog            = require('../models/auditLog.model');
const auditLogService     = require('../services/auditLog.service');

const router = express.Router();

// ── Route-level guard: every endpoint in this file requires a valid session
//    AND the caller must hold the 'super_admin' global role. ─────────────────
router.use(authentication, authorize(['super_admin']));

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users
// Returns a paginated, searchable list of all system users.
// Access: super_admin only
// ═════════════════════════════════════════════════════════════════════════════
router.get('/users', async (req, res, next) => {
  try {
    const {
      page   = 1,
      limit  = 10,
      search = ''
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page,  10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    // Build search filter — match against email (case-insensitive)
    const filter = search
      ? { email: { $regex: String(search).trim(), $options: 'i' } }
      : {};

    const [docs, totalDocs] = await Promise.all([
      User.find(filter)
        .select('-password')          // Never expose password hashes
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalDocs / limitNum);

    return res.status(200).json({
      docs,
      totalDocs,
      totalPages,
      page:  pageNum,
      limit: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    });
  } catch (err) {
    console.error('[Admin] Error fetching users:', err);
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/users/:userId/toggle-status
// Activates or deactivates a user account.
// Access: super_admin only
// ═════════════════════════════════════════════════════════════════════════════
router.put('/users/:userId/toggle-status', async (req, res, next) => {
  try {
    const userId = String(req.params.userId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    // Prevent super_admin from accidentally deactivating their own account
    if (userId === String(currentUserId)) {
      return res.status(400).json({
        error: 'You cannot modify the active status of your own account'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user format identity identifier' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Toggle the flag
    user.isActive = !user.isActive;
    await user.save();

    // Determine event type AFTER the toggle
    const action = user.isActive ? 'user.activated' : 'user.deactivated';

    // Record audit event
    await auditLogService.logUserEvent(action, req, {
      targetUserId:    user._id,
      targetUserEmail: user.email,
      newStatus:       user.isActive
    });

    return res.status(200).json({
      message: `User "${user.email}" ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id:       user._id,
        _id:      user._id,
        email:    user.email,
        role:     user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('[Admin] Error toggling user status:', err);
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/users/:userId/role
// Mutates a target user's authorization role (Global or Contextual Taxonomy).
// Access: super_admin only (Enforces dynamic RBAC restrictions)
// ═════════════════════════════════════════════════════════════════════════════
router.put('/users/:userId/role', async (req, res, next) => {
  try {
    const userId = String(req.params.userId).trim();
    const newRole = String(req.body?.role).trim();
    const currentUserId = req.user?.id || req.user?._id;

    // 1. Sanity check: prevent self-demotion to preserve at least one active Super Admin session
    if (userId === String(currentUserId)) {
      return res.status(400).json({
        error: 'Governance Restriction: You cannot modify or demote your own administrative role privileges'
      });
    }

    // 2. Validate parameters structures
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Validation Error: Invalid database reference target token ID' });
    }

    // Explicit taxonomy whitelist matching frontend options matrix arrays
    const validRoles = ['member', 'super_admin', 'org_admin', 'project_admin', 'developer', 'viewer'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: `Validation Error: Selected role taxonomy [${newRole}] is restricted or invalid.` });
    }

    // 3. Locate target account register matching criteria
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Target user record not found inside database registries.' });
    }

    // Block changes if target user is currently deactivated to prevent detached states
    if (!user.isActive) {
      return res.status(400).json({ error: 'Action Aborted: Cannot alter privilege tokens of suspended accounts.' });
    }

    const oldRole = user.role || 'member';
    user.role = newRole;
    await user.save();

    // 4. Clase 10 Audit Logging Integration
    await auditLogService.logTaskEvent('user.role_updated', req, {
      targetUserId: user._id,
      targetUserEmail: user.email,
      previousRole: oldRole,
      assignedRole: newRole,
      status: 'success',
      details: 'Super Admin successfully mutated target subject privileges role parameters.'
    });

    return res.status(200).json({
      message: `Privileges for "${user.email}" updated to ${newRole.toUpperCase()} successfully.`,
      user: {
        id:       user._id,
        _id:      user._id,
        email:    user.email,
        role:     user.role,
        isActive: user.isActive
      }
    });

  } catch (err) {
    console.error('[Admin] Error mutating user authorization role:', err);
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/audit-logs
// Returns paginated audit log entries, sorted by most recent first.
// Access: super_admin only
// ═════════════════════════════════════════════════════════════════════════════
router.get('/audit-logs', async (req, res, next) => {
  try {
    const {
      page    = 1,
      limit   = 20,
      order   = 'desc',
      event:  eventFilter = '',
      email:  emailFilter = '',
      ip:     ipFilter    = ''
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page,  10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;
    const sortDir  = order === 'asc' ? 1 : -1;

    const filter = {};
    if (eventFilter) filter.evento = String(eventFilter).trim();
    if (emailFilter) filter.email  = String(emailFilter).toLowerCase().trim();
    if (ipFilter)    filter.ip     = String(ipFilter).trim();

    const [rawDocs, totalDocs] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: sortDir })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'email')   // Populate operator email from User collection
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalDocs / limitNum);

    const docs = rawDocs.map((log) => ({
      _id:       log._id,
      event:     log.evento,
      timestamp: log.timestamp,
      operator:  log.userId ? { email: log.userId.email } : null,
      email:     log.email   || null,
      ip:        log.ip,
      userAgent: log.userAgent,
      payload:   log.detalles || null,
      statusCode: log.statusCode || null
    }));

    await auditLogService.logTaskEvent('audit.logs_viewed', req, {
      logsCount: docs.length,
      filters:   { event: eventFilter, email: emailFilter, ip: ipFilter }
    });

    return res.status(200).json({
      docs,
      totalDocs,
      totalPages,
      page:        pageNum,
      limit:       limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    });
  } catch (err) {
    console.error('[Admin] Error fetching audit logs:', err);
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/users/:userId/deactivate
// Deactivates a user account (sets isActive = false).
// Access: super_admin only
// ═════════════════════════════════════════════════════════════════════════════
router.patch('/users/:userId/deactivate', async (req, res, next) => {
  try {
    const userId = String(req.params.userId).trim();
    const currentUserId = req.user?.id || req.user?._id;

    if (userId === String(currentUserId)) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user target format ID' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.isActive) {
      return res.status(409).json({
        error: 'Account is already inactive',
        user: { id: user._id, email: user.email, isActive: false }
      });
    }

    user.isActive = false;
    await user.save();

    await auditLogService.logUserEvent('user.deactivated', req, {
      targetUserId:    user._id,
      targetUserEmail: user.email
    });

    return res.status(200).json({
      message: `Account "${user.email}" has been deactivated`,
      user: { id: user._id, email: user.email, role: user.role, isActive: false }
    });
  } catch (err) {
    console.error('[Admin] Error deactivating user:', err);
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/audit-stats
// Returns aggregated statistics about the audit log collection.
// Access: super_admin only
// ═════════════════════════════════════════════════════════════════════════════
router.get('/audit-stats', async (req, res, next) => {
  try {
    const [eventStats, failedLogins, totalLogs, logsLast24Hours] = await Promise.all([
      AuditLog.aggregate([
        { $group: { _id: '$evento', count: { $sum: 1 } } },
        { $sort:  { count: -1 } }
      ]),
      AuditLog.countDocuments({ evento: 'auth.login.failure' }),
      AuditLog.countDocuments(),
      AuditLog.countDocuments({
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    await auditLogService.logTaskEvent('audit.stats_viewed', req, { totalLogs });

    return res.status(200).json({
      success: true,
      stats: {
        totalLogs,
        logsLast24Hours,
        failedLogins,
        eventStats: eventStats.map(s => ({ event: s._id, count: s.count }))
      }
    });
  } catch (err) {
    console.error('[Admin] Error fetching audit statistics:', err);
    next(err);
  }
});

module.exports = router;