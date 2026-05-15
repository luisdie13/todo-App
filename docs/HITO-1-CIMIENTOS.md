# Hito 1: Cimientos, Auth y Modelos Base

## 🎯 Objetivo Completado
Configurar el entorno, la conexión a MongoDB y el flujo completo de identidad con seguridad de nivel empresarial.

---

## 📦 Backend - Estructura y Configuración

### Express y Middlewares de Seguridad ✅
- **Helmet**: Headers de seguridad HTTP
- **CORS**: Control de origen cruzado configurable
- **Rate Limiting**: Limitación de requests general
- **Error Handler**: Manejo centralizado de errores

**Archivo**: `src/app.js`

### Modelos de Base de Datos

#### 1. Usuario (`src/models/usuario.model.js`) ✅
```javascript
{
  email: String (único, lowercase, requerido),
  password: String (hasheado con bcrypt, min 8 caracteres),
  rol: String (enum: ['user', 'admin']),
  createdAt: Date
}
```

**Características:**
- Hashing de password automático con bcrypt (12 rounds)
- Método `compararPassword()` para validación
- Método `toJSON()` que excluye el password
- Pre-hook para actualizar password únicamente cuando se modifica

#### 2. Organization (`src/models/organization.model.js`) ✅
```javascript
{
  nombre: String (requerido, 3-100 caracteres),
  descripcion: String (opcional),
  creador: ObjectId (ref: Usuario),
  miembros: [
    {
      usuario: ObjectId,
      rol: String (enum: ['admin', 'miembro', 'visualizador']),
      fechaUnirsio: Date
    }
  ],
  estado: String (enum: ['activa', 'inactiva', 'suspendida']),
  createdAt: Date,
  updatedAt: Date
}
```

**Métodos:**
- `agregarMiembro(usuarioId, rol)` - Añade miembro a la organización
- `removerMiembro(usuarioId)` - Remueve miembro
- `obtenerRol(usuarioId)` - Obtiene el rol de un miembro
- `esAdmin(usuarioId)` - Verifica si es admin

#### 3. AuditLog (`src/models/auditLog.model.js`) ✅
Sistema completo de auditoría de seguridad con:
- Registro de eventos (6 tipos)
- Bloqueo permanente de eliminación
- Índices para búsquedas rápidas
- IP, userAgent, timestamp en cada registro

---

## 🔐 Autenticación y Autorización

### JWT (JSON Web Tokens)
- **Access Token**: Corta duración (1 hora)
- **Refresh Token**: Larga duración (7 días)
- Implementado en `src/services/tokenService.js`

### Flujo de Autenticación

#### 1. Registro (`POST /api/auth/registro`) ✅
```
Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (201):
{
  "mensaje": "Usuario registrado exitosamente",
  "usuario": { email, rol, _id, createdAt },
  "accessToken": "jwt_token",
  "refreshToken": "jwt_token"
}
```

**Validación Joi:**
- Email: válido y requerido
- Password: mínimo 6 caracteres, requerido

**Eventos Auditados:**
- ✅ `auth.register` (201)

#### 2. Login (`POST /api/auth/login`) ✅
```
Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200):
{
  "mensaje": "Sesión iniciada exitosamente",
  "usuario": { email, rol, _id, createdAt },
  "accessToken": "jwt_token",
  "refreshToken": "jwt_token"
}
```

**Validación Joi:**
- Email: válido y requerido
- Password: requerido

**Eventos Auditados:**
- ✅ `auth.login.success` (200)
- ✅ `auth.login.failure` (401)

#### 3. Refresh Token (`POST /api/auth/refresh`) ✅
```
Request:
{
  "refreshToken": "jwt_token"
}

Response (200):
{
  "mensaje": "Token refrescado exitosamente",
  "accessToken": "new_jwt_token",
  "refreshToken": "new_jwt_token"
}
```

#### 4. Logout (`POST /api/auth/logout`) ✅
```
Request:
{
  "refreshToken": "jwt_token"
}

Response (200):
{
  "mensaje": "Sesión cerrada exitosamente"
}
```

**Eventos Auditados:**
- ✅ `auth.logout` (200)

#### 5. Get Current User (`GET /api/auth/me`) ✅
```
Headers:
{
  "Authorization": "Bearer access_token"
}

Response (200):
{
  "usuario": { email, rol, _id, createdAt }
}
```

### Middleware de Autenticación (`src/middleware/authentication.js`) ✅

**Middleware `authentication`:**
- Valida token en header Authorization
- Formato: `Bearer <token>`
- Retorna 401 si token expirado, inválido o no existe
- Agrega `req.user` con información decodificada

**Middleware `authenticationOptional`:**
- Intenta validar pero no falla si no hay token
- Útil para rutas públicas/privadas opcionales

### Rate Limiting de Seguridad (`src/security/rateLimiter.js`) ✅

**Login Rate Limiter:**
- Máximo 5 intentos
- Ventana: 15 minutos
- Llave: IP + Email
- Eventos Auditados: `security.rate_limited` (429)

**Register Rate Limiter:**
- Máximo 3 intentos
- Ventana: 1 hora
- Llave: IP + Email

---

## 🎨 Frontend - React

### Estructura de Carpetas
```
frontend/
├── src/
│   ├── config/
│   │   └── axios.config.js
│   ├── services/
│   │   ├── authService.js
│   │   └── tokenStorage.js
│   ├── pages/
│   ├── components/
│   └── App.js
```

### Configuración de Axios (`frontend/src/config/axios.config.js`) ✅

**Interceptor de Request:**
- Agrega `Authorization: Bearer <token>` automáticamente
- Extrae token del localStorage

**Interceptor de Response:**
- Detecta errores 401 (Unauthorized)
- Intenta refrescar token automáticamente
- Reintenta la petición original
- Si falla, redirige a `/login`

**Features:**
- Refresh silencioso de tokens
- Redirección automática a login
- Manejo de token expirado

### Servicio de Almacenamiento de Tokens (`frontend/src/services/tokenStorage.js`) ✅

**Funciones:**
- `getAccessToken()` / `setAccessToken()` - Manejo de access token
- `getRefreshToken()` / `setRefreshToken()` - Manejo de refresh token
- `getUser()` / `setUser()` - Información del usuario
- `saveCredentials()` - Guarda todo después de login
- `clearCredentials()` - Limpia todo en logout
- `isAuthenticated()` - Verifica si hay sesión activa
- `decodeToken()` - Decodifica JWT (sin verificación)
- `isAccessTokenExpiringSoon()` - Alerta si token expira pronto

**Almacenamiento:**
- localStorage (persiste entre sesiones)
- Claves: `accessToken`, `refreshToken`, `user`

### Servicio de Autenticación (`frontend/src/services/authService.js`) ✅

**Métodos:**

1. **`register(email, password)`**
   - POST `/auth/registro`
   - Guarda credenciales automáticamente
   - Retorna `{ success, usuario, message }`

2. **`login(email, password)`**
   - POST `/auth/login`
   - Guarda credenciales automáticamente
   - Retorna `{ success, usuario, message }`

3. **`logout()`**
   - POST `/auth/logout`
   - Limpia credenciales locales
   - No falla si hay error del servidor

4. **`refreshAccessToken()`**
   - POST `/auth/refresh`
   - Actualiza tokens automáticamente
   - Limpia credenciales si falla

5. **`getCurrentUser()`**
   - GET `/auth/me`
   - Obtiene datos del usuario autenticado

---

## 📋 Archivos Creados/Modificados

### Backend

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `src/models/usuario.model.js` | ✅ | Modelo de Usuario |
| `src/models/organization.model.js` | ✅ | Modelo de Organization |
| `src/models/auditLog.model.js` | ✅ | Modelo de Auditoría |
| `src/services/auth.service.js` | ✅ | Servicio de Autenticación |
| `src/services/auditLog.service.js` | ✅ | Servicio de Auditoría |
| `src/services/tokenService.js` | ✅ | Manejo de JWT |
| `src/controllers/auth.controller.js` | ✅ | Controlador de Auth |
| `src/routes/auth.js` | ✅ | Rutas de Autenticación |
| `src/middleware/authentication.js` | ✅ | Middleware de Auth |
| `src/middleware/errorHandler.js` | ✅ | Manejo de Errores |
| `src/middleware/validate.js` | ✅ | Validación Joi |
| `src/security/rateLimiter.js` | ✅ | Rate Limiting |
| `src/validators/auth.validator.js` | ✅ | Esquemas Joi |
| `src/app.js` | ✅ | Configuración Express |

### Frontend

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| `frontend/src/config/axios.config.js` | ✅ | Configuración Axios + Interceptors |
| `frontend/src/services/tokenStorage.js` | ✅ | Almacenamiento de Tokens |
| `frontend/src/services/authService.js` | ✅ | Servicio de Autenticación |

---

## 🔒 Características de Seguridad Implementadas

### Backend
1. ✅ Bcrypt para hashing de passwords (12 rounds)
2. ✅ JWT con access + refresh tokens
3. ✅ Helmet para headers de seguridad
4. ✅ CORS configurable
5. ✅ Rate limiting en login y registro
6. ✅ Auditoría de seguridad completa
7. ✅ Middleware de autenticación
8. ✅ Validación con Joi
9. ✅ Manejo centralizado de errores
10. ✅ Bloqueo de borrado en auditoría

### Frontend
1. ✅ Interceptor de 401 automático
2. ✅ Refresh silencioso de tokens
3. ✅ localStorage para persistencia
4. ✅ Redirección automática a login
5. ✅ Decodificación de JWT para verificación
6. ✅ Detección de token próximo a expirar

---

## 🚀 Próximos Pasos

### Hito 2: Interfaz de Usuario
- [ ] Componentes React para Login/Register
- [ ] Context API para estado global de autenticación
- [ ] Rutas protegidas (PrivateRoute)
- [ ] Formularios validados

### Hito 3: Gestión de Tareas
- [ ] Modelo de Tarea con organización
- [ ] CRUD de tareas (Create, Read, Update, Delete)
- [ ] Filtros y búsqueda
- [ ] Asignación de tareas

### Hito 4: Colaboración
- [ ] Invitación de miembros a organización
- [ ] Gestión de roles
- [ ] Permisos por rol
- [ ] Notificaciones

---

## 📚 Referencias y Documentación

- **JWT**: `docs/TOKEN-SERVICE.md`
- **Auth Gateway**: `docs/AUTHENTICATION-GATEWAY.md`
- **Auditoría**: `evidencias/clase-10-audit.md`
- **Rate Limiting**: `evidencias/clase-9-rate-limiting.md`

---

## ✨ Resumen

El **Hito 1** establece una base sólida con:
- ✅ Estructura modular backend (MVC)
- ✅ Autenticación segura (JWT + Refresh)
- ✅ Frontend preparado para integración
- ✅ Auditoría y logging completo
- ✅ Rate limiting y protección
- ✅ Validación de entrada
- ✅ Manejo de errores robusto

La aplicación está lista para construir características de negocio en los siguientes hitos.
