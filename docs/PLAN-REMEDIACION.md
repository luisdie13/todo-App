# Plan de Remediación — todoApp

## Resumen Ejecutivo

La aplicación todoApp fue construida sin principios de seguridad desde el inicio. El análisis identificó 12 vulnerabilidades críticas que comprometen confidencialidad, integridad y disponibilidad de datos. Este plan de remediación establece un roadmap concreto para transformar la aplicación de completamente insegura a cumplir estándares de seguridad mínimos. Se priorizan las vulnerabilidades críticas para implementación inmediata, seguidas de mejoras de arquitectura a largo plazo.

---

## Tabla de Vulnerabilidades

| # | Vulnerabilidad | Severidad | OWASP | Principio | Clase |
|---|---|---|---|---|---|
| 1 | Sin autenticación en ningún endpoint | Crítica | A07 | Zero Trust | 2 |
| 2 | IDOR — modifica/borra tareas ajenas | Crítica | A01 | Menor Privilegio | 2 |
| 3 | Acepta `<script>` como título (XSS) | Alta | A03 | Defensa en Profundidad | 2 |
| 4 | `err.message` expuesto al cliente | Media | A04 | Fail Secure | 2 |
| 5 | Sin rate limiting — DoS trivial | Media | A04 | Seguro por Defecto | 3 |
| 6 | MongoDB sin autenticación | Crítica | A05 | Menor Privilegio | 3 |
| 7 | Mass assignment sin restricción | Alta | A04 | Economía de Mecanismo | 2 |
| 8 | Sin CORS configurado | Media | A05 | Separación de Responsabilidades | 3 |
| 9 | Sin headers de seguridad (Helmet) | Media | A05 | Defensa en Profundidad | 3 |
| 10 | Sin audit logs | Media | A09 | Zero Trust | 4 |
| 11 | Sin HTTPS | Crítica | A02 | Menor Privilegio | 4 |
| 12 | Connection string hardcodeada | Crítica | A05 | Seguro por Defecto | 2 |

---

## Detalle de Vulnerabilidades

### Vulnerabilidad #1: Sin Autenticación en Ningún Endpoint

- **Severidad**: Crítica
- **OWASP**: A07 — Identification and Authentication Failures
- **Principio violado**: Zero Trust
- **Descripción**: 
  Ningún endpoint requiere autenticación. Cualquier cliente puede crear, leer, actualizar o eliminar tareas sin proporcionar credenciales. La API no implementa ningún mecanismo de identificación de usuarios.

- **Solución concreta**:
  1. Instalar `jsonwebtoken` y `bcryptjs`
  2. Crear endpoint POST `/api/auth/register` que acepte `{email, password}`, hashee la contraseña con bcrypt, y almacene el usuario en MongoDB
  3. Crear endpoint POST `/api/auth/login` que valide email/password y retorne JWT firmado con secret en variable de entorno
  4. Crear middleware `authenticateToken` que valide el JWT en header `Authorization: Bearer <token>`, extraiga el userId y lo adjunte a `req.user`
  5. Aplicar middleware a todos los endpoints de tareas: `router.use(authenticateToken)`
  6. Retornar 401 si no hay token, 403 si token inválido

- **Clase del curso**: Clase 2 — Los 7 Principios de Diseño Seguro

---

### Vulnerabilidad #2: IDOR — Modifica/Borra Tareas Ajenas

- **Severidad**: Crítica
- **OWASP**: A01 — Broken Access Control
- **Principio violado**: Menor Privilegio
- **Descripción**: 
  Aunque haya autenticación, no se valida que el usuario sea el propietario de la tarea. Un usuario A puede modificar o eliminar tareas de usuario B conociendo sus IDs.

- **Solución concreta**:
  1. Actualizar schema Tarea: agregar campo `userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`
  2. En POST `/api/tareas`, guardar `tarea.userId = req.user.id` antes de guardar
  3. En PUT `/api/tareas/:id`, antes de actualizar: 
     ```javascript
     const tarea = await Tarea.findById(req.params.id);
     if (tarea.userId.toString() !== req.user.id) {
       return res.status(403).json({ error: 'Forbidden' });
     }
     ```
  4. En DELETE `/api/tareas/:id`, aplicar misma validación
  5. En GET `/api/tareas`, filtrar: `await Tarea.find({ userId: req.user.id })`

- **Clase del curso**: Clase 2 — Los 7 Principios de Diseño Seguro

---

### Vulnerabilidad #3: Acepta `<script>` como Título (XSS)

- **Severidad**: Alta
- **OWASP**: A03 — Injection
- **Principio violado**: Defensa en Profundidad
- **Descripción**: 
  El campo `title` no se sanitiza. Si se almacena `<script>alert(1)</script>` y se renderiza en HTML sin escapar, ejecutará código malicioso en navegadores de otros usuarios.

- **Solución concreta**:
  1. Instalar `xss` (npm install xss)
  2. En POST y PUT `/api/tareas`, sanitizar entrada:
     ```javascript
     const xss = require('xss');
     let { title, completed } = req.body;
     title = xss(title, { 
       whiteList: {}, 
       stripIgnoredTag: true,
       stripLeadingAndTrailingWhitespace: true 
     });
     ```
  3. Alternativamente, en frontend: escapar salida con DOMPurify o similar
  4. Establecer CSP header: `Content-Security-Policy: default-src 'self'`

- **Clase del curso**: Clase 2 — Los 7 Principios de Diseño Seguro

---

### Vulnerabilidad #4: `err.message` Expuesto al Cliente

- **Severidad**: Media
- **OWASP**: A04 — Insecure Design
- **Principio violado**: Fail Secure
- **Descripción**: 
  Los catch blocks retornan `{ error: err.message }` directamente. Esto expone nombres de modelos MongoDB, tipos de datos, y detalles internos que ayudan a atacantes.

- **Solución concreta**:
  1. En todos los catch blocks, cambiar de:
     ```javascript
     catch (err) {
       return res.status(500).json({ error: err.message });
     }
     ```
     A:
     ```javascript
     catch (err) {
       console.error('Detalles del error:', err);
       return res.status(500).json({ error: 'Error interno del servidor' });
     }
     ```
  2. Para validaciones específicas (Joi), retornar campos de error sin exponerlos:
     ```javascript
     if (!errors.isEmpty()) {
       return res.status(422).json({ errors: errors.array() });
     }
     ```

- **Clase del curso**: Clase 2 — Los 7 Principios de Diseño Seguro

---

### Vulnerabilidad #5: Sin Rate Limiting — DoS Trivial

- **Severidad**: Media
- **OWASP**: A04 — Insecure Design
- **Principio violado**: Seguro por Defecto
- **Descripción**: 
  Un atacante puede enviar miles de solicitudes por segundo para consumir recursos, simular un ataque DoS, o hacer fuerza bruta en endpoints de autenticación.

- **Solución concreta**:
  1. Instalar `express-rate-limit`: npm install express-rate-limit
  2. En `src/app.js`, después de `app.use(express.json())`:
     ```javascript
     const rateLimit = require('express-rate-limit');
     
     const limiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutos
       max: 100, // 100 solicitudes por ventana
       message: 'Demasiadas solicitudes, intente más tarde',
       standardHeaders: true,
       legacyHeaders: false,
     });
     
     app.use(limiter);
     ```
  3. Para endpoints de login, aplicar límite más estricto:
     ```javascript
     const loginLimiter = rateLimit({
       windowMs: 15 * 60 * 1000,
       max: 5,
       skipSuccessfulRequests: true
     });
     
     router.post('/login', loginLimiter, ...);
     ```

- **Clase del curso**: Clase 3 — Vulnerabilidades y Ataques Comunes

---

### Vulnerabilidad #6: MongoDB sin Autenticación

- **Severidad**: Crítica
- **OWASP**: A05 — Security Misconfiguration
- **Principio violado**: Menor Privilegio
- **Descripción**: 
  MongoDB está configurado sin autenticación. Cualquiera con acceso a la red (localhost:27017) puede conectarse y acceder a toda la base de datos sin credenciales.

- **Solución concreta**:
  1. En `docker-compose.yml`, descomentar y configurar variables:
     ```yaml
     services:
       mongodb:
         environment:
           MONGO_INITDB_ROOT_USERNAME: admin
           MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
           MONGO_INITDB_DATABASE: todo_app
     ```
  2. Crear archivo `.env`:
     ```
     MONGO_ROOT_PASSWORD=GeneratedSecurePassword123!
     MONGO_USER=todoapp
     MONGO_PASSWORD=AnotherSecurePass456!
     ```
  3. Modificar conexión en `src/server.js`:
     ```javascript
     const mongoUri = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@mongodb:27017/todo_app?authSource=admin`;
     ```
  4. Reiniciar contenedor de MongoDB
  5. Crear usuario específico para la aplicación (no usar root)

- **Clase del curso**: Clase 3 — Vulnerabilidades y Ataques Comunes

---

### Vulnerabilidad #7: Mass Assignment sin Restricción

- **Severidad**: Alta
- **OWASP**: A04 — Insecure Design
- **Principio violado**: Economía de Mecanismo
- **Descripción**: 
  Si el schema se extiende con campos como `admin: Boolean`, un atacante podría agregar `{"admin": true}` en el payload y escalar privilegios sin restricción.

- **Solución concreta**:
  1. Instalar `joi`: npm install joi
  2. En cada endpoint, validar explícitamente campos permitidos:
     ```javascript
     const schema = joi.object({
       title: joi.string().trim().required().min(3).max(200),
       completed: joi.boolean().optional()
     });
     
     const { error, value } = schema.validate(req.body);
     if (error) {
       return res.status(422).json({ error: error.details[0].message });
     }
     
     const { title, completed } = value;
     ```
  3. Nunca hacer `Object.assign(tarea, req.body)` o similar
  4. Usar destructuring explícito: `const { title, completed } = req.body`

- **Clase del curso**: Clase 2 — Los 7 Principios de Diseño Seguro

---

### Vulnerabilidad #8: Sin CORS Configurado

- **Severidad**: Media
- **OWASP**: A05 — Security Misconfiguration
- **Principio violado**: Separación de Responsabilidades
- **Descripción**: 
  Sin CORS, un navegador bloqueará solicitudes desde dominios diferentes. Aunque esto es una medida de defensa, debe configurarse explícitamente para mayor control.

- **Solución concreta**:
  1. Instalar `cors`: npm install cors
  2. En `src/app.js`:
     ```javascript
     const cors = require('cors');
     
     const corsOptions = {
       origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
       credentials: true,
       methods: ['GET', 'POST', 'PUT', 'DELETE'],
       allowedHeaders: ['Content-Type', 'Authorization'],
       maxAge: 3600
     };
     
     app.use(cors(corsOptions));
     ```
  3. En `.env`:
     ```
     ALLOWED_ORIGINS=http://localhost:3000,https://example.com
     ```
  4. En producción, restringir a dominio específico

- **Clase del curso**: Clase 3 — Vulnerabilidades y Ataques Comunes

---

### Vulnerabilidad #9: Sin Headers de Seguridad (Helmet)

- **Severidad**: Media
- **OWASP**: A05 — Security Misconfiguration
- **Principio violado**: Defensa en Profundidad
- **Descripción**: 
  Headers como `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` no están configurados. Esto expone la aplicación a clickjacking, MIME sniffing, y otros ataques.

- **Solución concreta**:
  1. Instalar `helmet`: npm install helmet
  2. En `src/app.js`, después de crear `app`:
     ```javascript
     const helmet = require('helmet');
     
     app.use(helmet());
     
     // Opcional: configuración más estricta
     app.use(helmet.contentSecurityPolicy({
       directives: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'"],
         imgSrc: ["'self'", 'data:', 'https:'],
       },
     }));
     ```
  3. Verificar headers en respuesta con `curl -I http://localhost:3000`

- **Clase del curso**: Clase 3 — Vulnerabilidades y Ataques Comunes

---

### Vulnerabilidad #10: Sin Audit Logs

- **Severidad**: Media
- **OWASP**: A09 — Security Logging and Monitoring Failures
- **Principio violado**: Zero Trust
- **Descripción**: 
  No hay registro de qué usuario hizo qué, cuándo, y desde dónde. Sin logs, es imposible investigar incidentes de seguridad o detectar actividad anómala.

- **Solución concreta**:
  1. Crear modelo AuditLog:
     ```javascript
     const auditSchema = new mongoose.Schema({
       userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
       action: String, // POST, PUT, DELETE, LOGIN
       resource: String, // 'tareas', 'users'
       resourceId: String,
       status: String, // 'success', 'failed'
       ip: String,
       userAgent: String,
       timestamp: { type: Date, default: Date.now }
     });
     ```
  2. Crear middleware logger:
     ```javascript
     const logAudit = async (req, res, next) => {
       const originalSend = res.send;
       res.send = function(data) {
         AuditLog.create({
           userId: req.user?.id,
           action: req.method,
           resource: 'tareas',
           status: res.statusCode < 400 ? 'success' : 'failed',
           ip: req.ip,
           userAgent: req.get('user-agent')
         });
         originalSend.call(this, data);
       };
       next();
     };
     ```
  3. Aplicar a endpoints: `router.use(logAudit)`

- **Clase del curso**: Clase 4 — Monitoreo y Respuesta a Incidentes

---

### Vulnerabilidad #11: Sin HTTPS

- **Severidad**: Crítica
- **OWASP**: A02 — Cryptographic Failures
- **Principio violado**: Menor Privilegio
- **Descripción**: 
  La aplicación usa HTTP sin encriptación. Credenciales y datos viajan en texto plano y pueden ser capturados por ataques man-in-the-middle.

- **Solución concreta**:
  1. En desarrollo local: usar HTTP es aceptable
  2. En producción (Docker + Nginx):
     - Obtener certificado SSL/TLS (Let's Encrypt gratuito)
     - Configurar Nginx como reverse proxy con HTTPS
     - Redirigir HTTP a HTTPS
  3. En `src/app.js`, agregar middleware para HTTPS en producción:
     ```javascript
     if (process.env.NODE_ENV === 'production') {
       app.use((req, res, next) => {
         if (req.header('x-forwarded-proto') !== 'https') {
           res.redirect(`https://${req.header('host')}${req.url}`);
         } else {
           next();
         }
       });
     }
     ```
  4. En docker-compose, incluir servicios Nginx con certificados

- **Clase del curso**: Clase 4 — Monitoreo y Respuesta a Incidentes

---

### Vulnerabilidad #12: Connection String Hardcodeada

- **Severidad**: Crítica
- **OWASP**: A05 — Security Misconfiguration
- **Principio violado**: Seguro por Defecto
- **Descripción**: 
  La URL de conexión a MongoDB contiene credenciales en el código fuente. Si el repositorio se hace público o se filtra, las credenciales están comprometidas.

- **Solución concreta**:
  1. Crear archivo `.env` (gitignored):
     ```
     MONGO_URI=mongodb://todoapp:SecurePassword@mongodb:27017/todo_app?authSource=admin
     PORT=3000
     JWT_SECRET=SuperSecureJWTSecretWithRandomChars123!
     NODE_ENV=development
     ```
  2. Agregar `.env` a `.gitignore`:
     ```
     .env
     .env.local
     node_modules/
     ```
  3. Crear `.env.example` con valores placeholder:
     ```
     MONGO_URI=mongodb://user:password@localhost:27017/todo_app
     PORT=3000
     JWT_SECRET=your-secret-key-here
     NODE_ENV=development
     ```
  4. Cambiar `src/server.js`:
     ```javascript
     require('dotenv').config();
     
     mongoose.connect(process.env.MONGO_URI)
       .then(() => app.listen(process.env.PORT, ...))
     ```
  5. Instalar dotenv: npm install dotenv

- **Clase del curso**: Clase 2 — Los 7 Principios de Diseño Seguro

---

## Sección Impacto: Vulnerabilidad Crítica #1 — Sin Autenticación

### Contexto
La ausencia de autenticación es la vulnerabilidad más crítica porque es el punto de entrada a todas las otras. Sin autenticación:
- No hay control de quién accede
- No hay audit de acciones
- No hay autorización (imposible saber quién es quién)
- Todos los datos están expuestos

### Escenarios de Ataque Reales

**Escenario 1: Robo de datos**
- Atacante A descubre la URL de la API: `http://localhost:3000/api/tareas`
- Ejecuta: `curl http://localhost:3000/api/tareas`
- Obtiene todas las tareas de todos los usuarios: títulos, fechas de creación, IDs
- Puede filtrar por patrones (ej: tareas con "pasaporte", "número de tarjeta")

**Escenario 2: Modificación maliciosa**
- Atacante descubre que usuario B existe
- Modifica una tarea de B: `PUT /api/tareas/idDeB`
- Agrega `<script>` al título para XSS
- Cuando B carga la app, ejecuta código malicioso

**Escenario 3: Negación de Servicio**
- Atacante automatiza creación de millones de tareas
- Base de datos crece sin control
- Servidor se ralentiza o cae
- Usuarios legítimos no pueden acceder

**Escenario 4: Cumplimiento regulatorio**
- App maneja datos de usuarios (posiblemente PIII)
- Sin autenticación, violaría GDPR, CCPA, u otras regulaciones
- Consecuencias: multas, demandas, reputación dañada

### Impacto en CIA (Confidentiality, Integrity, Availability)

| Pilar | Impacto | Ejemplo |
|------|---------|---------|
| **Confidentiality** | 🔴 CRÍTICO | Todos los datos son leíbles por cualquiera |
| **Integrity** | 🔴 CRÍTICO | Cualquiera puede modificar/eliminar datos ajenos |
| **Availability** | 🔴 CRÍTICO | DoS no autenticado agota recursos |

### Cadena de Explotación

```
Sin Autenticación
    ↓
No hay Autorización
    ↓
IDOR (Insecure Direct Object Reference)
    ↓
XSS + Mass Assignment
    ↓
Compromiso Total
```

### Esfuerzo de Remediación

- **Esfuerzo técnico**: ⭐⭐⭐ (Medio)
  - Implementar JWT: 4-6 horas
  - Endpoint de login/register: 2-3 horas
  - Pruebas: 3-4 horas
  - **Total: 9-13 horas de desarrollo**

- **Riesgo si no se implementa**: ⭐⭐⭐⭐⭐ (Crítico)
  - Riesgo de exposición: 100%
  - Probabilidad de explotación: 100% (trivial de explotar)

### Conclusión

Esta vulnerabilidad es el **bloqueador crítico** para cualquier despliegue en producción. Debe implementarse en **Fase 1** del plan de remediación. Sin autenticación, todas las demás mejoras de seguridad son insuficientes.

---

## Roadmap de Implementación

### Fase 1: Crítico (Semana 1-2)
- [ ] Vulnerabilidad #1: Sin autenticación
- [ ] Vulnerabilidad #2: IDOR
- [ ] Vulnerabilidad #12: Connection string hardcodeada
- [ ] Vulnerabilidad #6: MongoDB sin autenticación

### Fase 2: Alto (Semana 3-4)
- [ ] Vulnerabilidad #3: XSS
- [ ] Vulnerabilidad #7: Mass assignment
- [ ] Vulnerabilidad #4: Error messages

### Fase 3: Medio (Semana 5-6)
- [ ] Vulnerabilidad #5: Rate limiting
- [ ] Vulnerabilidad #9: Helmet
- [ ] Vulnerabilidad #8: CORS

### Fase 4: Monitoreo (Semana 7-8)
- [ ] Vulnerabilidad #10: Audit logs
- [ ] Vulnerabilidad #11: HTTPS
- [ ] Pruebas de penetración

---

## Referencias

- [OWASP Top 10 2025](https://owasp.org/Top10/)
- [7 Principios de Diseño Seguro](https://www.ncsc.gov.uk/collection/mobile-device-guidance/secure-development/threat-modelling)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Express Security Guide](https://expressjs.com/en/advanced/best-practice-security.html)


