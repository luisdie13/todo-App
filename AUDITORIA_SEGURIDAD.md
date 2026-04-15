# Auditoría de Seguridad — todoApp

## A. Portada

**Estudiante:** Luis Diego Oliva Castañeda 
**Curso:** Patrones de Diseño Orientados a la Seguridad  
**Docente:** Ing. Berny Cardona

---

## B. Resumen Ejecutivo

La aplicación todoApp presenta **vulnerabilidades críticas** que comprometen la seguridad de los datos. El análisis reveló la ausencia de autenticación y autorización en todos los endpoints, lo que permite a cualquier usuario no autenticado crear, leer, actualizar y eliminar tareas. Adicionalmente, no existe validación ni sanitización de entrada, permitiendo ataques XSS. Los mensajes de error exponen información sensible del sistema. La aplicación violenta principios fundamentales de Security by Design.

---

## C. Tabla de Vulnerabilidades Encontradas

| # | Vulnerabilidad | Severidad | OWASP | Endpoint Afectado |
|---|---|---|---|---|
| 1 | Falta de Autenticación en todos los endpoints | Crítica | A01 | POST/GET/PUT/DELETE /api/tareas |
| 2 | Falta de Validación de Entrada | Alta | A03 | POST /api/tareas |
| 3 | XSS - Inyección de Scripts sin Sanitización | Alta | A03 | POST /api/tareas |
| 4 | Exposición de Información en Mensajes de Error | Media | A05 | GET /api/tareas/:id |
| 5 | Ausencia de Rate Limiting | Media | A04 | Todos |
| 6 | Sin Autorización basada en Roles/Usuarios | Crítica | A01 | PUT/DELETE /api/tareas/:id |
| 7 | MongoDB sin Autenticación | Crítica | A02 | Configuración |

---

## D. Detalle de Cada Vulnerabilidad

### Vulnerabilidad #1: Falta de Autenticación en Todos los Endpoints

- **Severidad**: Crítica
- **Categoría OWASP**: A01 - Broken Access Control
- **Endpoint afectado**: POST, GET, PUT, DELETE /api/tareas
- **Descripción**: No existe mecanismo de autenticación. Cualquier usuario puede acceder a los endpoints sin credenciales, tokens o sesiones. La API no valida la identidad de quien realiza las solicitudes.
- **Cómo reproducir**:
```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Content-Type: application/json" \
  -d '{"title": "Tarea anónima sin login"}'
```
- **Evidencia**: La solicitud retorna HTTP 201 Created y crea la tarea exitosamente sin proporcionar credencial alguna.
- **Impacto**: Un atacante puede crear, leer, modificar y eliminar todas las tareas de cualquier usuario. Violación total de confidencialidad, integridad y disponibilidad de datos.
- **Remediación propuesta**: 
  - Implementar JWT (JSON Web Tokens) o sesiones de servidor
  - Requerir credenciales válidas en todas las solicitudes
  - Validar el token/sesión antes de procesar cualquier endpoint
  - Usar middleware de autenticación centralizado

```javascript
// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Aplicar a todas las rutas
router.use(authenticateToken);
```

---

### Vulnerabilidad #2: Falta de Validación de Entrada

- **Severidad**: Alta
- **Categoría OWASP**: A03 - Injection
- **Endpoint afectado**: POST /api/tareas
- **Descripción**: El endpoint no valida adecuadamente los datos de entrada. Acepta valores vacíos, tipos de datos inesperados, y campos adicionales no controlados que pueden ser inyectados.
- **Cómo reproducir**:
```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Content-Type: application/json" \
  -d '{"title": "", "completed": "no-es-boolean", "admin": true}'
```
- **Evidencia**: El servidor rechaza campos inválidos pero no de forma segura. La validación debe ser más estricta.
- **Impacto**: Posibilidad de inyectar datos malformados que pueden causar errores en la lógica de negocio o comportamiento inesperado.
- **Remediación propuesta**:
  - Usar bibliotecas de validación como `joi`, `yup` o `express-validator`
  - Validar tipo de datos, longitud y formato
  - Whitelist de campos permitidos
  - Rechazar campos no esperados

```javascript
const { body, validationResult } = require('express-validator');

router.post('/', [
  body('title').isString().trim().notEmpty().isLength({ max: 500 }),
  body('completed').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Solo procesar title y completed
  const { title, completed } = req.body;
  // ... resto del código
});
```

---

### Vulnerabilidad #3: XSS - Inyección de Scripts sin Sanitización

- **Severidad**: Alta
- **Categoría OWASP**: A03 - Injection
- **Endpoint afectado**: POST /api/tareas
- **Descripción**: El campo `title` acepta código JavaScript/HTML sin sanitización. Si los datos se muestran en el frontend sin escapar, pueden ejecutar scripts maliciosos en el navegador de otros usuarios.
- **Cómo reproducir**:
```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Content-Type: application/json" \
  -d '{"title": "<script>alert(document.cookie)</script>"}'
```
- **Evidencia**: La respuesta contiene literalmente: `{"title":"<script>alert(document.cookie)</script>",...}`
- **Impacto**: Un atacante puede robar cookies de sesión, redirigir usuarios, modificar el contenido de la página, capturar credenciales o ejecutar acciones en nombre del usuario.
- **Remediación propuesta**:
  - Sanitizar entrada usando bibliotecas como `xss` o `sanitize-html`
  - Escapar salida en el frontend
  - Usar Content Security Policy (CSP)
  - No confiar nunca en datos de usuario

```javascript
const xss = require('xss');

router.post('/', async (req, res) => {
  let { title, completed } = req.body;
  // Sanitizar entrada
  title = xss(title, { whiteList: {}, stripIgnoredTag: true });
  
  const tarea = new Tarea({ title, completed });
  await tarea.save();
  return res.status(201).json(tarea);
});
```

---

### Vulnerabilidad #4: Exposición de Información en Mensajes de Error

- **Severidad**: Media
- **Categoría OWASP**: A05 - Security Misconfiguration
- **Endpoint afectado**: GET /api/tareas/:id, PUT /api/tareas/:id, DELETE /api/tareas/:id
- **Descripción**: Los mensajes de error exponen información interna del sistema, incluyendo nombres de modelos MongoDB, tipos de datos esperados y rutas internas.
- **Cómo reproducir**:
```bash
curl http://localhost:3000/api/tareas/id-invalido
```
- **Evidencia**: Respuesta: `{"error":"Cast to ObjectId failed for value \"id-invalido\" (type string) at path \"_id\" for model \"Tarea\""}` Revela que usa MongoDB, el nombre del modelo y la estructura interna.
- **Impacto**: Información de reconocimiento que ayuda a atacantes a entender la arquitectura interna y buscar vulnerabilidades específicas.
- **Remediación propuesta**:
  - Mensajes de error genéricos para usuarios
  - Logging detallado solo en servidor
  - Nunca exponer detalles técnicos en respuestas de API

```javascript
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const tarea = await Tarea.findById(req.params.id).lean();
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
    return res.json(tarea);
  } catch (err) {
    console.error(err); // Log detallado en servidor
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});
```

---

### Vulnerabilidad #5: Ausencia de Rate Limiting

- **Severidad**: Media
- **Categoría OWASP**: A04 - Insecure Design
- **Endpoint afectado**: Todos los endpoints
- **Descripción**: No existe limitación de velocidad de solicitudes. Un atacante puede realizar miles de peticiones para consumir recursos (DoS), hacer fuerza bruta, o spammear la API.
- **Cómo reproducir**:
```bash
for i in $(seq 1 1000); do
  curl -s http://localhost:3000/api/tareas > /dev/null &
done
```
- **Evidencia**: Sin rate limiting, el servidor acepta todas las solicitudes sin restricción.
- **Impacto**: Ataques de negación de servicio (DoS), agotamiento de recursos, posibilidad de fuerza bruta en endpoints de autenticación futura.
- **Remediación propuesta**:
  - Implementar middleware de rate limiting
  - Limitar por IP, usuario o combinación
  - Usar `express-rate-limit`

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // 100 solicitudes por ventana
});

app.use(limiter);
```

---

### Vulnerabilidad #6: Ausencia de Autorización basada en Roles/Usuarios

- **Severidad**: Crítica
- **Categoría OWASP**: A01 - Broken Access Control
- **Endpoint afectado**: PUT /api/tareas/:id, DELETE /api/tareas/:id
- **Descripción**: No existe control de autorización. No se valida que el usuario que modifica/elimina una tarea sea el propietario. Cualquier usuario autenticado (si se implementa autenticación) podría modificar o eliminar tareas de otros usuarios.
- **Cómo reproducir**: Después de implementar autenticación, un usuario A podría eliminar tareas de usuario B usando sus IDs.
- **Impacto**: Integridad de datos comprometida. Usuarios pueden modificar o eliminar datos de otros usuarios sin autorización.
- **Remediación propuesta**:
  - Asociar cada tarea a un usuario propietario
  - Validar que solo el propietario o administrador pueda modificar/eliminar
  - Implementar RBAC (Role-Based Access Control)

```javascript
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const tarea = await Tarea.findById(req.params.id);
    if (!tarea) return res.status(404).json({ error: 'Not found' });
    
    // Verificar que el usuario es el propietario
    if (tarea.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }
    
    await Tarea.findByIdAndDelete(req.params.id);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
});
```

---

### Vulnerabilidad #7: MongoDB sin Autenticación

- **Severidad**: Crítica
- **Categoría OWASP**: A02 - Cryptographic Failures / A05 - Security Misconfiguration
- **Endpoint afectado**: Configuración (docker-compose.yml)
- **Descripción**: MongoDB está configurado sin autenticación. Si alguien accede a la red donde está MongoDB (localhost:27017), puede acceder a todos los datos sin credenciales.
- **Evidencia**: En docker-compose.yml, las variables de autenticación están comentadas.
- **Impacto**: Acceso no autorizado a la base de datos. Un atacante con acceso de red podría robar, modificar o eliminar toda la base de datos.
- **Remediación propuesta**:
  - Habilitar autenticación en MongoDB
  - Usar credenciales fuertes
  - Restringir acceso de red a MongoDB
  - Usar variables de entorno para credenciales

```yaml
# docker-compose.yml
services:
  mongodb:
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: todo_app
```

```javascript
// src/server.js
const mongoUri = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@localhost:27017/todo_app`;
mongoose.connect(mongoUri);
```

---

## E. Conclusiones

### Reflexión sobre los Hallazgos

La aplicación todoApp fue desarrollada sin considerar principios de **Security by Design**. Las vulnerabilidades encontradas no son accidentes sino el resultado de diseño inseguro:

1. **Ausencia de autenticación**: No se implementó ningún mecanismo de identificación de usuarios.
2. **Falta de validación**: No se validan ni sanitizan los datos de entrada.
3. **Sin autorización**: No hay control sobre quién puede acceder a qué recursos.
4. **Configuración insegura**: Base de datos sin autenticación y credenciales expuestas en código.

### Principios de Security by Design Violados

- **Secure by Default**: La aplicación no es segura por defecto.
- **Least Privilege**: No existe control de permisos granulares.
- **Defense in Depth**: No hay múltiples capas de seguridad.
- **Fail Securely**: Los errores exponen información sensible.
- **Keep it Simple**: Complejidad de seguridad es mínima pero insuficiente.

### Plan de Remediación Priorizado

**Prioridad 1 (Crítico - Implementar inmediatamente):**
1. Implementar autenticación JWT
2. Asociar tareas a usuarios propietarios
3. Implementar autorización por propietario
4. Habilitar autenticación en MongoDB
5. Sanitizar entrada contra XSS

**Prioridad 2 (Alto - Implementar en el próximo ciclo):**
1. Validación rigurosa de datos de entrada
2. Rate limiting
3. Mensajes de error genéricos
4. Logging de seguridad

**Prioridad 3 (Medio - Considerar para versiones futuras):**
1. Encriptación de datos sensibles
2. Auditoría detallada
3. Pruebas de seguridad automáticas (SAST)
4. Monitoreo de anomalías

### Conclusión Final

**La aplicación actual es completamente insegura y no debe usarse en producción.** Requiere rediseño significativo con seguridad como principio fundamental desde el inicio. Se recomienda implementar todas las remediaciones de Prioridad 1 antes de cualquier despliegue.


