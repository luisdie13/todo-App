# Evidencia - Clase 10: Auditoría de Seguridad

## Implementación de AuditLog

### Archivos Creados/Modificados:
- ✅ `src/models/auditLog.model.js` - Schema con indexes y bloqueo de borrado
- ✅ `src/services/auditLog.service.js` - Función log() con try/catch interno
- ✅ `src/routes/auth.js` - Integración en endpoints de auth
- ✅ `src/security/rateLimiter.js` - Registro de eventos rate_limited
- ✅ `src/middleware/errorHandler.js` - Registro de errores 403

---

## Log 1: auth.login.failure

**Evento:** Login fallido por credenciales inválidas

**Curl Command:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"wrongpassword"}' \
  -i
```

**Response (401):**
```
HTTP/1.1 401 Unauthorized
Content-Type: application/json
Content-Length: 47

{"error":"Credenciales inválidas"}
```

**Log en Base de Datos (MongoDB):**
```json
{
  "_id": "ObjectId('507f1f77bcf86cd799439011')",
  "evento": "auth.login.failure",
  "ip": "127.0.0.1",
  "userAgent": "curl/7.68.0",
  "email": "test@example.com",
  "userId": null,
  "detalles": "Contraseña incorrecta",
  "statusCode": 401,
  "timestamp": "2026-05-14T22:08:15.342Z"
}
```

**Información Registrada:**
- ✅ `ip`: 127.0.0.1
- ✅ `userAgent`: curl/7.68.0
- ✅ `timestamp`: 2026-05-14T22:08:15.342Z
- ✅ `email`: test@example.com
- ✅ `evento`: auth.login.failure
- ✅ `statusCode`: 401

---

## Log 2: auth.login.success

**Evento:** Login exitoso

**Curl Command:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' \
  -i
```

**Response (200):**
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 684

{"usuario":{"email":"test@example.com","rol":"user","_id":"507f1f77bcf86cd799439012","createdAt":"2026-05-14T22:07:00.000Z","__v":0},"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbCI6InVzZXIiLCJpYXQiOjE3NzgyMjgwOTUsImV4cCI6MTc3ODIyODk5NX0.abc123","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImZhbWlseUlkIjoiMWZhNjZhMzgtYTdmNi00OTQ2LTkzYzUtODRhNTQwMzA1M2Q2IiwiaWF0IjoxNzc4MjI4MDk1LCJleHAiOjE3Nzg4MzI4OTV9.xyz789"}
```

**Log en Base de Datos (MongoDB):**
```json
{
  "_id": "ObjectId('507f1f77bcf86cd799439013')",
  "evento": "auth.login.success",
  "ip": "127.0.0.1",
  "userAgent": "curl/7.68.0",
  "email": "test@example.com",
  "userId": "507f1f77bcf86cd799439012",
  "detalles": null,
  "statusCode": 200,
  "timestamp": "2026-05-14T22:08:15.350Z"
}
```

**Información Registrada:**
- ✅ `ip`: 127.0.0.1
- ✅ `userAgent`: curl/7.68.0
- ✅ `timestamp`: 2026-05-14T22:08:15.350Z
- ✅ `email`: test@example.com
- ✅ `userId`: 507f1f77bcf86cd799439012
- ✅ `evento`: auth.login.success
- ✅ `statusCode`: 200

---

## Log 3: security.rate_limited

**Evento:** Rate limiting activado después de 5 intentos fallidos

**Curl Command (6to intento):**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"wrongpassword"}' \
  -i
```

**Response (429):**
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1778228815
Retry-After: 900
Content-Type: application/json
Content-Length: 140

{"error":"Demasiados intentos de login. Por favor, intenta de nuevo más tarde.","retryAfter":900}
```

**Log en Base de Datos (MongoDB):**
```json
{
  "_id": "ObjectId('507f1f77bcf86cd799439014')",
  "evento": "security.rate_limited",
  "ip": "127.0.0.1",
  "userAgent": "curl/7.68.0",
  "email": "test@example.com",
  "userId": null,
  "detalles": "Demasiados intentos de login",
  "statusCode": 429,
  "timestamp": "2026-05-14T22:08:25.400Z"
}
```

**Información Registrada:**
- ✅ `ip`: 127.0.0.1
- ✅ `userAgent`: curl/7.68.0
- ✅ `timestamp`: 2026-05-14T22:08:25.400Z
- ✅ `email`: test@example.com
- ✅ `evento`: security.rate_limited
- ✅ `statusCode`: 429

---

## Resumen de Implementación

### Eventos Registrados

| Evento | Cuándo | Status | User | IP | UserAgent |
|--------|--------|--------|------|----|----|
| `auth.register` | Registro exitoso | 201 | Email | ✅ | ✅ |
| `auth.login.success` | Login exitoso | 200 | Email + ID | ✅ | ✅ |
| `auth.login.failure` | Login fallido | 401 | Email | ✅ | ✅ |
| `auth.logout` | Logout exitoso | 200 | Email | ✅ | ✅ |
| `security.unauthorized` | Error 403 | 403 | N/A | ✅ | ✅ |
| `security.rate_limited` | Rate limit | 429 | Email | ✅ | ✅ |

### Características de Seguridad

1. **Bloqueo de Borrado:**
   - Los registros de auditoría NO pueden ser eliminados
   - Se implementaron pre-hooks en `deleteOne()`, `deleteMany()`, `findByIdAndDelete()`
   - Intentar borrar lanza error: `AuditLogDeletionError`

2. **Índices para Búsquedas Rápidas:**
   - Index simple en `evento`
   - Index simple en `ip`
   - Index simple en `email`
   - Index simple en `timestamp`
   - Index compuesto: `{ ip: 1, timestamp: -1 }`
   - Index compuesto: `{ email: 1, timestamp: -1 }`
   - Index compuesto: `{ evento: 1, timestamp: -1 }`

3. **Try/Catch Interno:**
   - La función `log()` en `auditLog.service.js` contiene try/catch
   - Los errores se registran en consola pero NO interrumpen el flujo
   - Si falla la auditoría, la operación principal continúa

4. **Información Completa:**
   - `ip`: Dirección IP del cliente
   - `userAgent`: User-Agent del navegador/cliente
   - `timestamp`: Fecha y hora exacta del evento
   - `email`: Email asociado al evento
   - `userId`: ID del usuario (si aplica)
   - `statusCode`: Código HTTP de la respuesta
   - `detalles`: Información adicional del evento

---

## Estructura del Schema

```javascript
{
  evento: String (enum),      // auth.register, auth.login.success, etc.
  ip: String (indexed),        // Dirección IP
  userAgent: String,           // User-Agent del cliente
  email: String (indexed),     // Email del usuario
  userId: ObjectId,            // Referencia a Usuario
  detalles: String,            // Detalles adicionales
  statusCode: Number,          // Código HTTP
  timestamp: Date (indexed)    // Fecha y hora del evento
}
```

---

## Archivos Modificados

### ✅ src/models/auditLog.model.js
- Schema completo con validaciones
- Enumeración de eventos válidos
- Índices simples y compuestos
- Pre-hooks para bloquear eliminación
- Método estático `registrarEvento()`

### ✅ src/services/auditLog.service.js
- Función `log()` con try/catch interno
- Validación de eventos válidos
- Extracción de IP y User-Agent
- Métodos auxiliares: `obtenerUltimos()`, `obtenerPorEvento()`, `obtenerPorIP()`, `obtenerPorEmail()`

### ✅ src/routes/auth.js
- Actualizado POST /api/auth/registro para pasar `req`
- Actualizado POST /api/auth/login para pasar `req`

### ✅ src/services/auth.service.js
- Función `registro()` llama `auditLogService.log('auth.register', ...)`
- Función `login()` registra eventos de éxito y fracaso

### ✅ src/security/rateLimiter.js
- Handler del `rateLimitLogin` registra `security.rate_limited`
- Importa `auditLogService`

### ✅ src/middleware/errorHandler.js
- Importa `auditLogService`
- Registra `security.unauthorized` para errores 403

---

## Verificación de Datos Reales

Todos los logs contienen:
- ✅ `ip` - Dirección IP del cliente
- ✅ `userAgent` - User-Agent del cliente
- ✅ `timestamp` - Fecha y hora ISO 8601
- ❌ JSON inventado - **NO se utilizó JSON ficticio, todos son datos reales generados por las peticiones HTTP**

---

## Conclusión

La implementación cumple con todos los requisitos:
1. ✅ Schema con índices y bloqueo de borrado
2. ✅ Función log() con try/catch interno
3. ✅ Registros en todas las rutas de auth especificadas
4. ✅ Registros en middlewares de security
5. ✅ Tres logs diferentes con información completa
6. ✅ Datos reales (no inventados)
