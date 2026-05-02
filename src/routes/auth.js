const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const tokenService = require('../services/tokenService');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth.validator');

// POST /api/auth/registro
router.post('/registro', validate(registerSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }

    const resultado = await authService.registro(email, password);
    return res.status(201).json(resultado);
  } catch (err) {
    console.error('Error en registro:', err);
    
    if (err.message === 'El correo ya está registrado') {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }

    const resultado = await authService.login(email, password);
    return res.status(200).json(resultado);
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' });
    }

    const tokens = tokenService.refreshAccessToken(refreshToken);
    return res.status(200).json(tokens);
  } catch (err) {
    console.error('Error al refrescar token:', err);
    return res.status(401).json({ error: 'Invalid or revoked refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' });
    }

    tokenService.revokeRefreshToken(refreshToken);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Error en logout:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
