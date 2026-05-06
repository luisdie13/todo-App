# Evidencia - Clase 9: Rate Limiting

## Curl 1: 6to intento de login → 429

**Comando:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' \
  -i
```

**Output (Intento 6 - Bloqueado):**
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1778111089
Retry-After: 899
Content-Type: application/json
Content-Length: 140

{"error":"Demasiados intentos de login. Por favor, intenta de nuevo más tarde.","retryAfter":899}
```

**Explicación:**
- Los primeros 5 intentos fueron aceptados con status 401 (credenciales inválidas)
- El 6to intento fue rechazado con status **429 Too Many Requests**
- El header `Retry-After: 899` indica que debe esperar ~900 segundos (15 minutos) antes de intentar de nuevo
- La llave de rate limiting combina IP + Email: `127.0.0.1-test@example.com`

---

## Curl 2: Register 4ta vez desde misma IP → 429

**Comando:**
```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -H 'Content-Type: application/json' \
  -d '{"email":"register4@example.com","password":"password123"}' \
  -i
```

**Output (Intento 4 - Bloqueado):**
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1778115639
Retry-After: 3599
Content-Type: application/json
Content-Length: 150

{"error":"Demasiados intentos de registro desde esta dirección. Por favor, intenta de nuevo más tarde.","retryAfter":3599}
```

**Explicación:**
- Límite de registro: 3 intentos en 1 hora
- Los primeros 3 registros fueron exitosos (status 201)
- El 4to intento fue rechazado con status **429**
- El header `Retry-After: 3599` indica que debe esperar ~3600 segundos (1 hora)
- Cada registro exitoso devolvió usuario, accessToken y refreshToken

---

## Curl 3: Login dentro del límite → 200

**Comando:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"register1@example.com","password":"password123"}' \
  -i
```

**Output (Login Exitoso):**
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 684

{"usuario":{"email":"register1@example.com","rol":"user","_id":"69fbd20d79643161aecb43d3","createdAt":"2026-05-06T23:43:09.320Z","__v":0},"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZmJkMjBkNzk2NDMxNjFhZWNiNDNkMyIsImVtYWlsIjoicmVnaXN0ZXIxQGV4YW1wbGUuY29tIiwicm9sIjoidXNlciIsImlhdCI6MTc3ODExMDk4OSwiZXhwIjoxNzc4MTExODg5fQ.TuovCcChkhqfGK-4G98oWQT08N3BU8PQijdNCHBSLic","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZmJkMjBkNzk2NDMxNjFhZWNiNDNkMyIsImVtYWlsIjoicmVnaXN0ZXIxQGV4YW1wbGUuY29tIiwiZmFtaWx5SWQiOiIxZmE2NmEzOC1hN2Y2LTQ5NDYtOTNjNS04NGE1NDAzMDUzZDYiLCJpYXQiOjE3NzgxMTA5ODksImV4cCI6MTc3ODcxNTc4OX0.6zZjjo0PgOhmP5TkOEHYXYsfgpsnAtNN9Rw3eNB9ZZg"}
```

**Explicación:**
- Un usuario registrado (register1@example.com) puede hacer login exitosamente
- Status **200 OK** indica que el login fue aceptado
- Se devuelve el usuario, accessToken y refreshToken
- Como es el primer intento de este usuario, no se alcanza el límite de 5 intentos
- Rate Limiting basado en IP + Email permite diferentes usuarios desde la misma IP

---

## Resumen de Configuración

### Login Rate Limiter
- **Límite:** 5 intentos
- **Ventana:** 15 minutos (900 segundos)
- **Llave:** `IP + Email`
- **Archivo:** `src/security/rateLimiter.js`

### Register Rate Limiter
- **Límite:** 3 intentos
- **Ventana:** 1 hora (3600 segundos)
- **Llave:** `IP + Email`
- **Archivo:** `src/security/rateLimiter.js`

### General Rate Limiter (endpoints autenticados)
- **Límite:** 100 intentos
- **Ventana:** 1 minuto (60 segundos)
- **Llave:** `UserID (si está autenticado) o IP`
- **Archivo:** `src/security/rateLimiter.js`

### Archivos Modificados
- ✅ `src/security/rateLimiter.js` - Definición de los limitadores
- ✅ `src/routes/auth.js` - Aplicación de limitadores a endpoints

### Headers de Respuesta
- `X-RateLimit-Limit`: Número máximo de intentos permitidos
- `X-RateLimit-Remaining`: Intentos restantes
- `X-RateLimit-Reset`: Timestamp de cuando se resetea el contador
- `Retry-After`: Segundos a esperar antes de reintentar (en respuestas 429)

---

## Ventajas de esta Implementación

1. **Protección contra ataques de fuerza bruta:** Limita intentos de login y registro
2. **Uso de llave combinada (IP + Email):** Previene bloqueos falsos de usuarios legítimos en la misma red
3. **Headers de respuesta útiles:** El cliente puede saber cuándo reintentar
4. **Diferentes límites por endpoint:** Mayor protección en puntos críticos (login/registro)
5. **Escalable:** Fácil de ajustar límites sin reescribir código
