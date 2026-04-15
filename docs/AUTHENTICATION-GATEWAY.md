# Authentication Gateway Implementation — todoApp

## Descripción General

Se ha implementado un Authentication Gateway completo que actúa como punto de entrada único para la autenticación y autorización de la API REST todoApp. Esta implementación sigue los patrones de seguridad enseñados en las clases 4, 5 y 6.

---

## Arquitectura Implementada

### Capas de Seguridad

```
Request HTTP
    ↓
┌───────────────────────────┐
│ Capa 1: Helmet (Headers)  │  ← X-Frame-Options, CSP, etc.
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Capa 2: CORS              │  ← Controlar orígenes permitidos
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Capa 3: Rate Limiting     │  ← Prevenir DoS
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Capa 4: JSON Body Limit   │  ← Max 10kb payload
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Ruta (Auth o Tareas)      │
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Capa 5: Middleware Auth   │  ← JWT Verification (solo tareas)
└───────────────────────────┘
    ↓
┌───────────────────────────┐
│ Controlador / Servicio    │
└───────────────────────────┘
```

---

## Componentes Implementados

### 1. Modelo de Usuario (usuario.model.js)

```javascript
// Campos
- email: String (único, requerido, lowercase, trimmed)
- password: String (requerido, mín 8 caracteres)
- rol: String (enum: 'user', 'admin', default: 'user')
- createdAt: Date

// Métodos
- compararPassword(passwordIngresada) → Promise<Boolean>
- toJSON() → Object sin password
- Pre-save hook: Hash password con bcrypt (12 rounds, salt)
```

**Seguridad:**
- Contraseñas hasheadas con bcrypt (12 rounds)
- Campo password nunca se devuelve en respuestas
- Email único para evitar duplicados
- Rol seguro por defecto: 'user'

---

### 2. Middleware de Autenticación (middleware/autenticacion.js)

```javascript
// Función: autenticarToken(req, res, next)
// Entrada: Header Authorization: Bearer <token>
// Salida: req.usuario = { id, email, rol }
// Errores:
//   - 401: Token requerido
//   - 403: Token inválido o expirado
```

**Flujo:**
1. Extrae token del header `Authorization: Bearer <token>`
2. Verifica firma usando `JWT_SECRET`
3. Si válido, adjunta usuario a `req.usuario`
4. Si inválido, retorna 403 Forbidden

---

### 3. Servicio de Autenticación (services/auth.service.js)

#### `registro(email, password)`

```
Flujo:
1. Validar que el email no esté registrado
2. Crear nuevo usuario
3. Hash password automático (pre-save hook)
4. Generar JWT token (15 min expiration)
5. Retornar { usuario, token }

Respuesta 201:
{
  "usuario": {
    "_id": "...",
    "email": "user@example.com",
    "rol": "user",
    "createdAt": "2026-04-15T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `login(email, password)`

```
Flujo:
1. Buscar usuario por email
2. Comparar password con bcrypt
3. Si válido, generar JWT token (15 min)
4. Retornar { usuario, token }

Errores:
- 401: Credenciales inválidas (genérico para ambos casos)
```

#### `generarToken(usuario)`

```javascript
// Payload del JWT
{
  id: usuario._id,
  email: usuario.email,
  rol: usuario.rol,
  iat: <fecha_emision>,
  exp: <fecha_expiracion>  // +15 minutos
}
```

---

### 4. Rutas de Autenticación (routes/auth.js)

#### POST /api/auth/registro

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@example.com", "password": "MiPassword123"}'
```

**Validaciones:**
- Email y password requeridos
- Email debe ser válido (formato email)
- Password mínimo 8 caracteres
- Email único en BD

**Respuestas:**
- 201 Created: Usuario creado exitosamente
- 400 Bad Request: Falta email o password
- 409 Conflict: El correo ya está registrado
- 500 Internal Server Error: Error del servidor (genérico)

#### POST /api/auth/login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@example.com", "password": "MiPassword123"}'
```

**Validaciones:**
- Email y password requeridos
- Credenciales válidas (comparación con bcrypt)

**Respuestas:**
- 200 OK: Login exitoso
- 400 Bad Request: Falta email o password
- 401 Unauthorized: Credenciales inválidas
- 500 Internal Server Error: Error del servidor

---

### 5. Rutas Protegidas de Tareas (routes/tareas.js)

Todas las operaciones de tareas requieren JWT válido.

#### POST /api/tareas (Crear)

```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"title": "Mi tarea", "completed": false}'
```

**Seguridad:**
- Requiere autenticación
- Asocia tarea al usuarioId del token
- Valida que title no esté vacío
- Máximo 10kb de payload

---

#### GET /api/tareas (Listar)

```bash
curl -X GET http://localhost:3000/api/tareas \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Seguridad:**
- Requiere autenticación
- Solo retorna tareas del usuario autenticado
- Filtra por `usuarioId == req.usuario.id`

---

#### GET /api/tareas/:id (Obtener una)

```bash
curl -X GET http://localhost:3000/api/tareas/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Seguridad:**
- Requiere autenticación
- Valida que el usuario sea propietario (IDOR mitigation)
- Retorna 403 si no es propietario

---

#### PUT /api/tareas/:id (Actualizar)

```bash
curl -X PUT http://localhost:3000/api/tareas/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"title": "Tarea actualizada", "completed": true}'
```

**Seguridad:**
- Requiere autenticación
- Solo propietario puede actualizar (IDOR mitigation)
- Valida campos antes de actualizar

---

#### DELETE /api/tareas/:id (Eliminar)

```bash
curl -X DELETE http://localhost:3000/api/tareas/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Seguridad:**
- Requiere autenticación
- Solo propietario puede eliminar
- Retorna 204 No Content

---

## Vulnerabilidades Mitigadas

| # | Vulnerabilidad | Mitigada | Mecanismo |
|---|---|---|---|
| 1 | Sin autenticación | ✓ | JWT en middleware |
| 2 | IDOR | ✓ | Validar usuarioId propietario |
| 3 | XSS | Parcial | Trim input, validación básica |
| 4 | Error messages | ✓ | Mensajes genéricos |
| 5 | DoS/Rate Limit | ✓ | express-rate-limit |
| 6 | MongoDB sin auth | ✓ | Via .env (a configurar) |
| 7 | Mass assignment | ✓ | Destructuring explícito |
| 8 | CORS abierto | ✓ | CORS configurado restricto |
| 9 | Sin headers | ✓ | Helmet middleware |
| 10 | Sin logs | Pendiente | Clase 4 |
| 11 | Sin HTTPS | Pendiente | Producción |
| 12 | Connection hardcodeada | ✓ | Variables de entorno (.env) |

---

## Flujo Completo de Autenticación

### 1. Registro

```
POST /api/auth/registro
├─ Body: { email, password }
├─ Hash password (bcrypt, 12 rounds)
├─ Guardar usuario en BD
├─ Generar JWT (15 min expiration)
└─ Response: { usuario, token }
```

### 2. Login

```
POST /api/auth/login
├─ Body: { email, password }
├─ Buscar usuario por email
├─ Comparar password con bcrypt
├─ Generar JWT (15 min expiration)
└─ Response: { usuario, token }
```

### 3. Acceso a Recursos Protegidos

```
GET/POST/PUT/DELETE /api/tareas/...
├─ Header: Authorization: Bearer <TOKEN>
├─ Middleware autenticarToken
├─ Verificar firma JWT
├─ Validar expiración
├─ Extraer usuario del payload
├─ Si tareas: validar propietario (usuarioId)
└─ Procesar solicitud
```

---

## Variables de Entorno (.env)

```env
NODE_ENV=development                                    # Ambiente
PORT=3000                                               # Puerto
MONGO_URI=mongodb://localhost:27017/todo_app            # BD
JWT_SECRET=SuperSecureJWTSecretWithRandomChars123!      # Firma JWT
ALLOWED_ORIGINS=http://localhost:3000                   # CORS whitelist
```

**Importante:** `.env` está en `.gitignore` y nunca se sube a repositorio.

---

## Ejemplos de Prueba

### Caso 1: Registro exitoso

```bash
$ curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Password123"}'

Response:
{
  "usuario": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "test@example.com",
    "rol": "user",
    "createdAt": "2026-04-15T08:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Caso 2: Crear tarea sin token

```bash
$ curl -X POST http://localhost:3000/api/tareas \
  -H "Content-Type: application/json" \
  -d '{"title": "Mi tarea"}'

Response:
{
  "error": "Token requerido"
}
HTTP/1.1 401 Unauthorized
```

### Caso 3: Crear tarea con token válido

```bash
$ curl -X POST http://localhost:3000/api/tareas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"title": "Mi tarea"}'

Response:
{
  "_id": "507f1f77bcf86cd799439012",
  "title": "Mi tarea",
  "completed": false,
  "usuarioId": "507f1f77bcf86cd799439011",
  "createdAt": "2026-04-15T08:05:00.000Z"
}
HTTP/1.1 201 Created
```

### Caso 4: IDOR mitigation - Acceso denegado

```bash
# Usuario A intenta acceder a tarea de Usuario B
$ curl -X GET http://localhost:3000/api/tareas/507f1f77bcf86cd799439999 \
  -H "Authorization: Bearer <TOKEN_USER_A>"

Response:
{
  "error": "No tienes permiso para acceder a esta tarea"
}
HTTP/1.1 403 Forbidden
```

---

## Principios de Seguridad Aplicados

### Zero Trust
- ✓ Cada solicitud requiere autenticación
- ✓ Ningún endpoint se confía por defecto
- ✓ Validación en cada layer

### Least Privilege
- ✓ Usuarios creados como 'user' por defecto
- ✓ Solo pueden ver/editar sus propias tareas
- ✓ Admin rol existe pero sin funcionalidad

### Fail Secure
- ✓ Mensajes de error genéricos (no expone estructura)
- ✓ Logging en servidor, no en cliente
- ✓ Rechaza por defecto

### Defensa en Profundidad
- ✓ 5 capas de seguridad antes de controller
- ✓ Validación en modelo, servicio y ruta
- ✓ JWT + autorización por propietario

### Secure by Default
- ✓ Contraseñas hasheadas obligatoriamente
- ✓ Tokens de corta duración (15 min)
- ✓ CORS restricto, no abierto a todos

---

## Conclusión

El Authentication Gateway implementado proporciona una base sólida de seguridad que mitigaSiguientes pasos (Clase 6+):
- Implementar Refresh Tokens para mejorar UX
- Agregar Audit Logs
- Configurar HTTPS en producción
- Implementar 2FA


