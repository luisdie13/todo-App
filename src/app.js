require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// Enrutadores
const authRouter = require('./routes/auth');
const tasksRouter = require('./routes/tasks');
const organizationsRouter = require('./routes/organizations');
const projectsRouter = require('./routes/projects');
const adminRouter = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Capa 1 y 2: Headers de seguridad y CORS
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001,http://localhost:3000').split(',');
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
};
app.use(cors(corsOptions));

// Capa 3: Parsers de entrada (CRÍTICO: DEBEN IR AQUÍ ANTES DE RATE LIMITING Y RUTAS)
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser()); // <--- Activación mandatoria ANTES de las rutas

// Capa 4: Rate Limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV !== 'production' ? 999999 : 100,
  message: 'Demasiadas solicitudes, intente más tarde',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // En desarrollo, saltar el rate limit para debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[RATE LIMIT SKIPPED] ${req.method} ${req.path} - En desarrollo`);
      return true;
    }
    return false;
  }
});
app.use(limiter);

// Capa 5: Registro de Rutas de la API
app.get('/', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/admin', adminRouter);

// Manejo de errores (debe ser el último middleware)
app.use(errorHandler);

module.exports = app;
