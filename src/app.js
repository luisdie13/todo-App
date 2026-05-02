require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const tareasRouter = require('./routes/tareas');
const authRouter = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');
const app = express();

// Middlewares de seguridad - Capa 1: Headers de seguridad
app.use(helmet());

// Middlewares de seguridad - Capa 2: CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
};
app.use(cors(corsOptions));

// Middlewares de seguridad - Capa 3: Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes, intente más tarde',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Middleware para parsear JSON
app.use(express.json({ limit: '10kb' }));

// Rutas
app.get('/', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/tareas', tareasRouter);

// Middleware de manejo de errores centralizado (debe ser el último)
app.use(errorHandler);

module.exports = app;
