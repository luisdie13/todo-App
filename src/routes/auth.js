const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { rateLimitLogin, rateLimitRegister } = require('../security/rateLimiter');

// POST /api/auth/registro
router.post('/registro', rateLimitRegister, validate(registerSchema), authController.register);

// POST /api/auth/login
router.post('/login', rateLimitLogin, validate(loginSchema), authController.login);

// POST /api/auth/refresh
router.post('/refresh', authController.refresh);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// GET /api/auth/me
router.get('/me', authController.getMe);

module.exports = router;
