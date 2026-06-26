const tokenService = require('../services/tokenService');

/**
 * Authentication Middleware
 *
 * Validates the Bearer JWT present in the Authorization header.
 * After signature verification, the middleware performs a live database
 * lookup to confirm that the corresponding user account is still active.
 * This catches the "deactivated-after-token-issue" race condition.
 *
 * Attaches decoded token payload to `req.user` on success.
 */
const authentication = async (req, res, next) => {
  try {
    // ── 1. Require Authorization header ────────────────────────────────────
    const authHeader = req.get('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required — no token provided'
      });
    }

    // ── 2. Validate "Bearer <token>" format ────────────────────────────────
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Invalid Authorization header format — expected "Bearer <token>"'
      });
    }

    const token = parts[1];

    // ── 3. Cryptographically verify the JWT signature ──────────────────────
    const decoded = tokenService.verifyAccessToken(token);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        error: 'Invalid or malformed token'
      });
    }

    // ── 4. Live account status check ───────────────────────────────────────
    //    We deliberately query the DB here (not just trust the token payload)
    //    so that a super_admin deactivation takes effect immediately — even
    //    before the current token expires.
    const User = require('../models/user.model');
    const user = await User.findById(decoded.id).select('isActive').lean();

    if (!user) {
      return res.status(403).json({
        error: 'Account not found',
        code:  'ACCOUNT_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account has been deactivated — contact your administrator',
        code:  'ACCOUNT_INACTIVE'
      });
    }

    // ── 5. Attach decoded payload and continue ─────────────────────────────
    req.user = decoded;
    next();

  } catch (err) {
    // ── Distinguish between common JWT error types ─────────────────────────
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired — please refresh your session',
        code:  'TOKEN_EXPIRED'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token is invalid or has been tampered with',
        code:  'TOKEN_INVALID'
      });
    }

    console.error('[Auth] Unexpected authentication error:', err.message);
    return res.status(401).json({
      error: 'Authentication failed — please log in again'
    });
  }
};

/**
 * Optional Authentication Middleware
 *
 * Attempts to validate the JWT but does NOT reject the request if no token
 * is present or if validation fails. Useful for public endpoints that can
 * optionally personalize their response for authenticated users.
 */
const authenticationOptional = (req, res, next) => {
  try {
    const authHeader = req.get('Authorization');

    if (!authHeader) {
      return next(); // No token — proceed as anonymous
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next(); // Malformed header — proceed as anonymous
    }

    const token   = parts[1];
    const decoded = tokenService.verifyAccessToken(token);

    if (decoded) {
      req.user = decoded;
    }

    next();
  } catch (err) {
    // Silently ignore all errors in optional authentication
    next();
  }
};

module.exports = {
  authentication,
  authenticationOptional
};
