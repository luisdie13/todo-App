# Token Service Implementation — Refresh Token Rotation

## Descripción

Implementación de un Token Service que maneja dos tipos de tokens JWT:
- **Access Token**: Corta vida (15 min), usado para acceder a recursos
- **Refresh Token**: Larga vida (7 días), usado solo para renovar access tokens

Incluye rotación automática de refresh tokens para detectar robos.

---

## Arquitectura

### Flujo de Tokens

```
1. LOGIN
┌─ usuario envía email + password
├─ backend verifica credenciales
├─ genera Access Token (15 min, JWT_SECRET)
├─ genera Refresh Token (7d, JWT_REFRESH_SECRET)
├─ guarda Refresh Token en store con familyId
└─ retorna { accessToken, refreshToken, user }

2. ACCESO A RECURSOS
┌─ cliente envía GET /api/tareas + Authorization: Bearer <accessToken>
├─ middleware verifica accessToken con JWT_SECRET
├─ si válido, procesa solicitud
└─ si expirado → 401, cliente debe hacer refresh

3. REFRESH (cuando accessToken vence)
┌─ cliente envía POST /refresh + { refreshToken }
├─ backend verifica refreshToken con JWT_REFRESH_SECRET
├─ verifica que NO esté revocado
├─ MARCA VIEJO COMO REVOCADO (rotación)
├─ genera nuevo accessToken
├─ genera nuevo refreshToken (mismo familyId)
└─ retorna { accessToken, refreshToken }

4. LOGOUT
┌─ cliente envía POST /logout + { refreshToken }
├─ backend marca refreshToken como revocado
└─ cliente borra tokens locales
```

---

## Componentes

### 1. Token Service (src/services/tokenService.js)

#### `generateAccessToken(usuario)`

```javascript
// Entrada: Usuario object { _id, email, rol }
// Salida: JWT string

// Payload
{
  id: usuario._id,
  email: usuario.email,
  rol: usuario.rol,
  iat: <timestamp>,
  exp: <timestamp + 15m>
}

// Firmado con: JWT_SECRET
```

**Ejemplo:**
```javascript
const token = tokenService.generateAccessToken(usuario);
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbCI6InVzZXIiLCJpYXQiOjE3Mzc5OTk5OTksImV4cCI6MTczODAwMDkwMH0.x..."
```

---

#### `generateRefreshToken(usuario, familyId = null)`

```javascript
// Entrada: Usuario object, opcional familyId (uuidv4)
// Salida: { token: JWT string, familyId: uuid }

// Payload
{
  id: usuario._id,
  email: usuario.email,
  familyId: "550e8400-e29b-41d4-a716-446655440000",
  iat: <timestamp>,
  exp: <timestamp + 7d>
}

// Firmado con: JWT_REFRESH_SECRET

// Guardado en store:
refreshTokenStore.set(token, {
  userId: usuario._id,
  familyId: familyId,
  createdAt: Date.now(),
  isRevoked: false
})
```

**Ejemplo:**
```javascript
const { token, familyId } = tokenService.generateRefreshToken(usuario);
// token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImZhbWlseUlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIiwiaWF0IjoxNzM3OTk5OTk5LCJleHAiOjE3MzgwMDA5MDB9.x..."
// familyId: "550e8400-e29b-41d4-a716-446655440000"
```

---

#### `refreshAccessToken(refreshToken)`

```javascript
// Entrada: refreshToken (JWT string)
// Salida: { accessToken: JWT, refreshToken: JWT }
// Error: "Invalid or revoked refresh token"

// Proceso
1. Buscar token en store
2. Si no existe o está revocado → error
3. Verificar firma del token con JWT_REFRESH_SECRET
4. Extraer familyId del payload
5. MARCAR VIEJO COMO REVOCADO (rotación)
6. Generar nuevo accessToken
7. Generar nuevo refreshToken (mismo familyId)
8. Retornar ambos
```

**Ejemplo:**
```javascript
const tokens = tokenService.refreshAccessToken(refreshToken);
// {
//   accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
// }
```

---

#### `revokeRefreshToken(refreshToken)`

```javascript
// Entrada: refreshToken (JWT string)
// Propósito: Marcar como revocado (logout)

// Proceso
1. Buscar token en store
2. Marcar como isRevoked: true
3. Lanzar error si no existe
```

**Ejemplo:**
```javascript
tokenService.revokeRefreshToken(refreshToken);
// Token marcado como revocado
```

---

#### `revokeRefreshTokenFamily(familyId)`

```javascript
// Entrada: familyId (uuid)
// Propósito: Revocar TODA una familia de tokens (detección de robo)

// Proceso
1. Iterar sobre todos los tokens en store
2. Si familyId coincide, marcar como revocado
```

**Ejemplo:**
```javascript
tokenService.revokeRefreshTokenFamily(familyId);
// Todos los tokens con ese familyId revocados
```

---

### 2. Auth Service Actualizado (src/services/auth.service.js)

#### `registro(email, password)`

```javascript
// Antes retornaba: { usuario, token }
// Ahora retorna: { usuario, accessToken, refreshToken }

const resultado = await authService.registro(email, password);
// {
//   usuario: { _id, email, rol, createdAt },
//   accessToken: "eyJ...",
//   refreshToken: "eyJ..."
// }
```

---

#### `login(email, password)`

```javascript
// Antes retornaba: { usuario, token }
// Ahora retorna: { usuario, accessToken, refreshToken }

const resultado = await authService.login(email, password);
// {
//   usuario: { _id, email, rol, createdAt },
//   accessToken: "eyJ...",
//   refreshToken: "eyJ..."
// }
```

---

### 3. Rutas Actualizadas (src/routes/auth.js)

#### POST /api/auth/login

**Antes:**
```json
{
  "usuario": { "id": "...", "email": "test@test.com" },
  "token": "eyJ..."
}
```

**Ahora:**
```json
{
  "usuario": { "id": "...", "email": "test@test.com", "rol": "user" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

#### POST /api/auth/refresh (NUEVA)

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<token-del-login>"}'

HTTP/1.1 200 OK
{
  "accessToken": "eyJ...(NUEVO)",
  "refreshToken": "eyJ...(NUEVO)"
}
```

**Validaciones:**
- refreshToken requerido en body
- Token debe existir en store
- Token no debe estar revocado
- Firma debe ser válida

**Errores:**
- 400: Refresh token requerido
- 401: Invalid or revoked refresh token

---

#### POST /api/auth/logout (NUEVA)

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<token-actual>"}'

HTTP/1.1 200 OK
{
  "message": "Logged out successfully"
}
```

**Validaciones:**
- refreshToken requerido en body
- Token es marcado como revocado

**Después del logout:**
```bash
# Intentar usar el mismo refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<token-revocado>"}'

HTTP/1.1 401 Unauthorized
{
  "error": "Invalid or revoked refresh token"
}
```

---

## Rotación de Refresh Tokens

### Concepto

Cada vez que un refresh token se usa, es marcado como **revocado** y uno nuevo es generado. Esto permite detectar robos:

```
Cliente legítimo (Timeline correcto):

1. Login → recibe RT1
2. RT1 vence → llama refresh con RT1 → obtiene RT2 (RT1 marcado revocado)
3. RT2 vence → llama refresh con RT2 → obtiene RT3 (RT2 marcado revocado)
   ✓ Flujo esperado, todo bien


Atacante robó RT1:

1. Cliente legítimo: vence RT1 → refresh (RT1 → RT2)
   - RT1 marcado revocado
   - Cliente recibe RT2

2. Atacante intenta: refresh con RT1 (que ya está revocado)
   - ERROR: "Invalid or revoked refresh token"
   - ALERTA: Detección de robo automática
   - Recomendación: Revocar toda la familia (logout en todos dispositivos)
```

### Family IDs

Todos los tokens generados en un "login" comparten el mismo **familyId** (uuid):

```javascript
// Login
const { token: RT1, familyId: "abc-123" } = generateRefreshToken(user);

// Refresh 1
const { token: RT2, familyId: "abc-123" } = generateRefreshToken(user, "abc-123");

// Refresh 2
const { token: RT3, familyId: "abc-123" } = generateRefreshToken(user, "abc-123");

// Si se detecta robo, revocar TODA la familia:
revokeRefreshTokenFamily("abc-123");
```

---

## In-Memory Store

El token store actual usa `Map()` de JavaScript (en memoria):

```javascript
const refreshTokenStore = new Map();

// Estructura
refreshTokenStore.set(token, {
  userId: ObjectId,
  familyId: "uuid",
  createdAt: Date,
  isRevoked: false
})
```

**Ventajas:**
- ✓ Ultra rápido
- ✓ Simple de implementar
- ✓ Perfecto para desarrollo

**Desventajas:**
- ✗ Se pierde si servidor reinicia
- ✗ No escala a múltiples servidores
- ✗ Consumo de memoria ilimitado

**Para producción:**
- Usar Redis (rápido, distribuido)
- O base de datos con TTL (expiración automática)

---

## Variables de Entorno

```env
JWT_SECRET=SuperSecureAccessTokenSecret123!
JWT_REFRESH_SECRET=SuperSecureRefreshTokenSecret456!
JWT_REFRESH_EXPIRES_IN=7d
```

**Importante:**
- Ambos secretos deben ser diferentes
- Ambos deben ser suficientemente largos
- Nunca compartir entre ambientes

---

## Seguridad

### Principios aplicados

1. **Rotación:** Token viejo = token muerto (un solo uso)
2. **Familia:** Detecta robos por anomalía en secuencia
3. **Corta vida:** Access token (15 min) minimiza daño si es robado
4. **Larga vida:** Refresh token permite UX buena sin logout frecuente
5. **Secretos diferentes:** Imposibilita confusión de tokens

### Almacenamiento recomendado

**Cliente (Frontend):**
- ✓ Access Token: `localStorage` o memoria
- ✓ Refresh Token: `httpOnly Cookie` (más seguro)

**Servidor:**
- ✓ Redis: Preferido (rápido, TTL automático)
- ✗ Base de datos: Viable pero más lento
- ✓ In-Memory: Desarrollo solamente

---

## Pruebas

### Test 1: Login devuelve dos tokens

```bash
$ curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!"}'

{
  "usuario": {"_id":"...","email":"test@test.com","rol":"user"},
  "accessToken": "eyJhbGciOiJIUzI1...",
  "refreshToken": "eyJhbGciOiJIUzI1..."
}
```

Verificar que:
- ✓ accessToken es corto (15 min)
- ✓ refreshToken es diferente (7d)
- ✓ Ambos son JWTs válidos

---

### Test 2: Access token funciona

```bash
$ curl http://localhost:3000/api/tareas \
  -H "Authorization: Bearer <accessToken>"

[{ "_id": "...", "title": "Mi tarea", "usuarioId": "..." }]
```

---

### Test 3: Refresh genera nuevo token

```bash
$ curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<RT1>"}'

{
  "accessToken": "eyJhbGciOiJIUzI1...(NUEVO)",
  "refreshToken": "eyJhbGciOiJIUzI1...(NUEVO)"
}
```

Guardar nuevo accessToken y refreshToken.

---

### Test 4: Token viejo rechazado (rotación)

```bash
# Usar el MISMO refreshToken del Test 3
$ curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<RT1-VIEJO>"}'

{
  "error": "Invalid or revoked refresh token"
}
```

Esto comprueba que RT1 fue marcado revocado.

---

### Test 5: Logout invalida token

```bash
$ curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<RT-ACTUAL>"}'

{
  "message": "Logged out successfully"
}

# Intentar refresh con el mismo token
$ curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<RT-REVOCADO>"}'

{
  "error": "Invalid or revoked refresh token"
}
```

---

## Conclusión

El Token Service implementa el patrón de dos tokens con rotación de refresh tokens, proporcionando:
- ✓ Seguridad: Tokens cortos, rotación, detección de robo
- ✓ UX: Refresh automático sin logout frecuente
- ✓ Arquitectura: Escalable a Redis/DB en producción


