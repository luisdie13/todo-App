const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
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
router.post('/login', async (req, res) => {
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

module.exports = router;
