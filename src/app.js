require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

// Importación de enrutadores
const authRouter = require("./routes/auth");
const tasksRouter = require("./routes/tasks");
const organizationsRouter = require("./routes/organizations");
const projectsRouter = require("./routes/projects");
const adminRouter = require("./routes/admin.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// 1. Seguridad básica
app.use(helmet());

// 2. Configuración estricta de CORS (CRÍTICO)
// El middleware cors() ya maneja automáticamente las peticiones OPTIONS pre-flight
const corsOptions = {
  origin: "http://localhost:3001", // Puerto exacto de tu React
  credentials: true,               // Permite enviar cookies/tokens
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));
// ELIMINADA: app.options('*', cors(corsOptions)); // Esta línea causaba el PathError

// 3. Parsers
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// 4. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV !== "production" ? 999999 : 100
});
app.use(limiter);

// 5. Registro de Rutas
app.use("/api/auth", authRouter);
app.use("/api/organizations", organizationsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/admin", adminRouter);

app.get("/", (req, res) => res.json({ status: "API OK" }));

// Manejo de errores
app.use(errorHandler);

module.exports = app;