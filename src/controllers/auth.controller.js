const authService = require('../services/auth.service');
const auditLogService = require('../services/auditLog.service');
const tokenService = require('../services/tokenService');

/**
 * auth.controller.js — Secure Authentication Controller Gateway.
 * * Requirements Met:
 * - Secures credential endpoints by sanitizing dynamic input contexts (NoSQL Mitigation).
 * - Restricts Refresh Tokens to HttpOnly cookies, preventing JavaScript visibility vectors.
 * - Aligns operational logging actions cleanly with the central immutable database registry.
 */

/**
 * POST /api/auth/register
 * Provisions a fresh user credential ledger model to the backend database.
 */
const register = async (req, res, next) => {
  try {
    // Explicit typecasting and sanitization to block structure-based NoSQL Injections
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    const name = req.body?.name ? String(req.body.name).trim() : 'Workspace Collaborator';

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password validation parameters are required.' 
      });
    }

    // Provision the new user entity cleanly via auth layer service
    const result = await authService.register(email, password, name, req);

    return res.status(201).json({
      message: 'User identity record provisioned successfully.',
      user: {
        id: result.user._id || result.user.id,
        _id: result.user._id || result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role || 'member'
      },
      accessToken: result.accessToken
    });

  } catch (err) {
    console.error('[AuthController] Registration lifecycle aborted:', err.message);

    if (err.message === 'Email is already registered') {
      return res.status(409).json({ 
        error: 'Identity Conflict: Provided email context is already registered.' 
      });
    }

    next(err);
  }
};

/**
 * POST /api/auth/login
 * Validates session credentials and issues volatile authorization signatures.
 */
const login = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password verification fields are required.' 
      });
    }

    const result = await authService.login(email, password, req);

    // Enforce cryptographic token boundaries via HttpOnly secure cookies
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days lifespan window
    });

    // CRITICAL: Maps ids polymorphically to avoid client-side state mapping failures
    return res.status(200).json({
      message: 'Session verified successfully.',
      user: {
        id: result.user._id || result.user.id,
        _id: result.user._id || result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role
      },
      accessToken: result.accessToken
    });

  } catch (err) {
    console.error('[AuthController] Authentication sequence failed:', err.message);

    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ 
        error: 'Authentication Rejected: Invalid credential parameters.' 
      });
    }

    if (err.message === 'User account is inactive') {
      return res.status(403).json({ 
        error: 'Access Denied: This account ledger state is currently inactive.' 
      });
    }

    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Silent Refresh Window — Rotates session bindings securely via cookie layers.
 */
const refresh = async (req, res, next) => {
  try {
    if (!req.cookies || !req.cookies.refreshToken) {
      console.warn('[AuthController] Stale or missing session token intercept in refresh pipeline.');
      return res.status(401).json({ 
        error: 'Access Denied: No active session or refresh token signature found.' 
      });
    }

    const currentRefreshToken = String(req.cookies.refreshToken).trim();

    try {
      // FIX: Added 'await' to resolve the asynchronous token validation and database lookup promise
      const tokens = await tokenService.refreshAccessToken(currentRefreshToken);

      // Re-issue updated sliding window refresh token back into safe storage cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days sliding lifespan
      });

      // SECURITY ENFORCEMENT: Never send the refreshToken inside the JSON body payload
      return res.status(200).json({
        message: 'Token rotated and synchronized successfully.',
        accessToken: tokens.accessToken
      });

    } catch (tokenError) {
      console.error('[AuthController] Cryptographic silent refresh error:', tokenError.message);
      return res.status(401).json({ 
        error: 'Session Expired: Stale token signature or invalid authorization properties.' 
      });
    }

  } catch (err) {
    console.error('[AuthController] Silent refresh loop crashed:', err.message);
    return res.status(401).json({ 
      error: 'Security Abort: Could not re-authenticate active session parameters.' 
    });
  }
};

/**
 * POST /api/auth/logout
 * Revokes long-lived active token models and wipes browser tracking footprints.
 */
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Action Aborted: Refresh token specification required for secure revocation.' 
      });
    }

    // Invalidate refresh signature from Mongoose collection token models asynchronously
    await tokenService.revokeRefreshToken(String(refreshToken).trim());

    // Wipe out the secure cookie browser reference allocation boundary
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    const cleanEmail = String(req.body?.email || req.user?.email || 'unassigned@perimeter.com').toLowerCase().trim();
    
    // Compliance Check: Realigned to use the unified logTaskEvent method matching your architecture rules
    await auditLogService.logTaskEvent('auth.logout', req, {
      email: cleanEmail,
      status: 'success',
      details: 'User explicitly terminated active session context window.'
    });

    return res.status(200).json({ 
      message: 'Session context dismantled and closed successfully.' 
    });

  } catch (err) {
    console.error('[AuthController] Error clearing session context layout:', err.message);
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Resolves and transmits the current operational authenticated identity.
 */
const getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Access Denied: Not authenticated inside secure memory scope.' 
      });
    }

    // CRÍTICO: Map dual fields to fully stabilize tracking layouts across React SPAs
    return res.status(200).json({
      user: {
        id: req.user.id || req.user._id,
        _id: req.user.id || req.user._id,
        email: req.user.email,
        name: req.user.name || 'Workspace Asset',
        role: req.user.role
      }
    });

  } catch (err) {
    console.error('[AuthController] Error resolving context status self metadata profile:', err.message);
    next(err);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe
};