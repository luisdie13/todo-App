/**
 * Role-Based Authorization Middleware
 *
 * Verifies that the authenticated user holds one of the required global roles.
 * Must be applied AFTER the `authentication` middleware so that `req.user`
 * is already populated with the decoded JWT payload.
 *
 * @param {string[]} allowedRoles - Array of global roles that may access the route
 * @returns {Function} Express middleware
 *
 * @example
 * router.use(authentication, authorize(['super_admin']));
 * router.put('/sensitive', authentication, authorize(['super_admin', 'admin']), handler);
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    // Guard: authentication middleware must have run first
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        error: 'Access denied — no user role could be identified'
      });
    }

    const hasPermission = allowedRoles.includes(req.user.role);

    if (!hasPermission) {
      return res.status(403).json({
        error: `Access denied — this action requires one of the following roles: [${allowedRoles.join(', ')}]`
      });
    }

    // Role check passed — hand off to the route handler
    next();
  };
};

module.exports = {
  authorize
};
