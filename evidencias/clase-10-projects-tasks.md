# Clase 10: Proyectos, Tareas y Audit Log

## Resumen de Implementación

Se ha implementado la lógica central del negocio con control de acceso basado en atributos (ABAC), incluyendo:
- **Modelos**: Membership (relación usuario-proyecto con roles)
- **Rutas de Proyectos y Tareas**: Con validación de permisos y auditoría
- **Audit Logging**: Registro de todas las operaciones de tareas
- **Frontend**: Vista de proyectos y creación de tareas

---

## PARTE 1: BACKEND - MODELOS Y RUTAS

### 1. Modelo de Membresía (`src/models/membership.model.js`)

**Campos:**
- `userId`: Referencia al usuario
- `projectId`: Referencia al proyecto/organización
- `role`: Rol del usuario en el proyecto
  - `project_admin`: Administrador total del proyecto
  - `developer`: Puede crear y editar sus propias tareas
  - `viewer`: Solo lectura

**Índices:**
- Índice compuesto único `{userId: 1, projectId: 1}` - Previene membresías duplicadas

**Métodos:**
- `hasRole(role)` - Verifica rol específico
- `isAdmin()` - Verifica si es administrador
- `canWrite()` - Verifica permisos de escritura
- `canRead()` - Verifica permisos de lectura

---

### 2. Rutas de Proyectos (`src/routes/projects.js`)

#### GET /api/projects
**Propósito**: Obtiene "Mis Proyectos"
**Retorna**:
- Proyectos creados por el usuario
- Proyectos donde el usuario es miembro
- Total de proyectos

**Respuesta**:
```json
{
  "success": true,
  "projects": {
    "created": [...],
    "memberOf": [...]
  },
  "total": 2
}
```

#### GET /api/projects/:projectId
**Propósito**: Obtiene detalles de un proyecto específico
**Validaciones**:
- Verifica que el usuario sea creador o miembro
- Retorna el rol del usuario en el proyecto

---

### 3. Rutas de Tareas

#### GET /api/projects/:projectId/tasks
**Propósito**: Lista todas las tareas del proyecto
**Validaciones**:
- Usuario debe ser miembro del proyecto
- Retorna tareas ordenadas por creación (más nuevas primero)

**Respuesta**:
```json
{
  "proyecto": "projectId",
  "tareas": [...],
  "total": 5
}
```

#### POST /api/projects/:projectId/tasks
**Propósito**: Crea una nueva tarea
**Permisos**: `project_admin` o `developer`
**Validaciones**:
- Valida que el título no esté vacío
- Verifica permisos usando `canCreateTask()`
- Registra en auditoría al crear exitosamente

**Request**:
```json
{
  "title": "Nombre de la tarea",
  "description": "Descripción opcional"
}
```

#### GET /api/projects/:projectId/tasks/:taskId
**Propósito**: Obtiene detalles de una tarea
**Validaciones**:
- Usuario debe ser miembro del proyecto

#### PUT /api/projects/:projectId/tasks/:taskId
**Propósito**: Actualiza una tarea
**Permisos**:
- `project_admin`: Puede editar cualquier tarea
- `developer`: Solo puede editar sus propias tareas
- `viewer`: No puede editar

**Validaciones**:
- Usa middleware `checkEditPermission`
- Registra cambios en auditoría

#### DELETE /api/projects/:projectId/tasks/:taskId
**Propósito**: Elimina una tarea
**Permisos**: Mismos que PUT
**Auditoría**: Registra eliminación con ID y título de la tarea

---

## PARTE 2: SEGURIDAD - AUDIT LOGGING

### Middleware de Auditoría (`src/middleware/auditMiddleware.js`)

**Propósito**: Registra eventos de tareas con:
- `actorId`: ID del usuario que realiza la acción
- `ip`: Dirección IP de la solicitud
- `userAgent`: Navegador/cliente

**Eventos Registrados**:
1. `task.created` - Nueva tarea creada
2. `task.updated` - Tarea modificada
3. `task.deleted` - Tarea eliminada
4. `task.unauthorized_access` - Intento de acceso no autorizado

**Middlewares**:
```javascript
router.post('/:id', auditTaskCreate, controller);
router.put('/:id', auditTaskUpdate, controller);
router.delete('/:id', auditTaskDelete, controller);
```

### Servicio de Auditoría Mejorado (`src/services/auditLog.service.js`)

**Nueva Función**: `logTaskEvent(evento, req, options)`

**Parámetros**:
- `evento`: Tipo de evento
- `req`: Objeto request (para extraer IP y userAgent)
- `options`: 
  - `taskId`: ID de la tarea
  - `projectId`: ID del proyecto
  - `taskTitle`: Título de la tarea
  - `action`: GET, POST, PUT, DELETE
  - `reason`: Razón de rechazo (si aplica)

**Ejemplo de Registro**:
```
[AUDIT TASK] task.created | User: 60d5ec49c1234567890abc12 | IP: 192.168.1.1 | 
Task ID: 60d5ec49c1234567890abc34 | Project ID: 60d5ec49c1234567890abc56 | 
Title: Implementar login
```

### Modelo AuditLog Actualizado (`src/models/auditLog.model.js`)

**Nuevos Eventos Soportados**:
```javascript
enum: [
  'auth.register',
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'security.unauthorized',
  'security.rate_limited',
  'task.created',        // NUEVO
  'task.updated',        // NUEVO
  'task.deleted',        // NUEVO
  'task.unauthorized_access' // NUEVO
]
```

---

## PARTE 3: CONTROL DE ACCESO (ABAC)

### Middleware de Permisos (`src/middleware/checkPermission.js`)

#### canCreateTask(user, projectId)
```
SI projectId NO existe:
  ✓ Permitir (usuario autenticado puede crear tareas personales)

SI projectId existe:
  ¿Existe membresía (userId, projectId)?
    NO → Denegar (403)
    SÍ → ¿user.role es project_admin o developer?
      SÍ → Permitir
      NO → Denegar (403)
```

#### canEditTask(user, task)
```
SI task.projectId NO existe:
  ¿user es propietario de la tarea?
    SÍ → Permitir
    NO → Denegar

SI task.projectId existe:
  ¿Existe membresía?
    NO → Denegar
    SÍ → ¿user.role es project_admin?
      SÍ → Permitir (editar cualquier tarea)
      NO → ¿user.role es developer Y es propietario?
        SÍ → Permitir
        NO → Denegar
```

---

## PARTE 4: FRONTEND - VISTAS

### Componente Project (`frontend/src/pages/Project.jsx`)

**Funcionalidades**:
1. **Encabezado del Proyecto**:
   - Nombre, estado, y rol del usuario
   - Botón para volver al dashboard

2. **Información del Proyecto**:
   - Creador
   - Cantidad de miembros

3. **Sección de Tareas**:
   - Lista de tareas del proyecto
   - Condicionales basados en rol del usuario

4. **Crear Tarea** (si tiene permisos):
   - Formulario con título y descripción
   - Validación de campos
   - Estado de envío

5. **Tarjeta de Tarea** (TaskCard):
   - Muestra título, estado (completada/pendiente)
   - Creador de la tarea
   - Fecha de creación
   - Botones editar/eliminar (si tiene permisos)

**Estados**:
- `project`: Datos del proyecto
- `tasks`: Array de tareas
- `loading`: Estado de carga
- `userRole`: Rol del usuario actual
- `showCreateForm`: Mostrar formulario de crear tarea

**Permisos en el Frontend**:
```javascript
canCreateTasks = userRole === 'project_admin' || userRole === 'developer'
canEditTasks = userRole === 'project_admin' || userRole === 'developer'
```

### Servicio de Proyectos (`frontend/src/services/projectService.js`)

**Funciones Exportadas**:

1. **getMyProjects()**: Obtiene lista de "Mis Proyectos"
2. **getProject(projectId)**: Obtiene detalles de un proyecto
3. **getProjectTasks(projectId)**: Lista tareas del proyecto
4. **createTask(projectId, taskData)**: Crea nueva tarea
5. **getTask(projectId, taskId)**: Obtiene una tarea específica
6. **updateTask(projectId, taskId, taskData)**: Actualiza tarea
7. **deleteTask(projectId, taskId)**: Elimina tarea

**Todos incluyen**:
- Manejo de autenticación (token JWT)
- Manejo de errores
- Respuestas estructuradas: `{ success, data/error }`

---

## FLUJO COMPLETO: Crear una Tarea

### 1. Frontend
```javascript
// Usuario click en "+ Nueva Tarea"
handleCreateTask() {
  // 1. Validación local
  if (!formData.title) return error

  // 2. Llamar servicio
  result = await createTask(projectId, formData)
  
  // 3. Actualizar estado
  if (result.success) {
    fetchProjectData() // Recargar
  } else {
    setError(result.error) // Mostrar error
  }
}
```

### 2. Backend - Ruta
```javascript
POST /api/projects/:projectId/tasks
{
  "title": "Nueva feature",
  "description": "Implementar login"
}
```

### 3. Backend - Controlador
```javascript
// 1. Validar entrada
if (!title) return 400

// 2. Verificar permisos
canCreate = await canCreateTask(usuario, projectId)
if (!canCreate) {
  // Registrar intento fallido
  logTaskEvent('task.unauthorized_access', ...)
  return 403
}

// 3. Crear tarea
tarea = new Tarea({ title, usuarioId, projectId })
await tarea.save()

// 4. Registrar en auditoría
logTaskEvent('task.created', req, {
  taskId: tarea._id,
  projectId,
  taskTitle: tarea.title
})

// 5. Retornar respuesta
return 201 { tarea }
```

### 4. Auditoría
```
Base de Datos (auditLogs):
{
  evento: 'task.created',
  userId: '60d5ec49c1234567890abc12',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  detalles: 'Task ID: ... | Project ID: ... | Title: Nueva feature',
  timestamp: 2024-05-23T18:10:00Z
}
```

---

## Tablas de Control de Acceso

### Permisos por Rol - Crear Tarea
| Rol | Permiso | Razón |
|-----|---------|-------|
| project_admin | ✓ Sí | Tiene control total |
| developer | ✓ Sí | Puede crear tareas |
| viewer | ✗ No | Solo lectura |
| Sin membresía | ✗ No | No acceso al proyecto |

### Permisos por Rol - Editar Tarea
| Rol | Propia | Ajena | Razón |
|-----|--------|-------|-------|
| project_admin | ✓ Sí | ✓ Sí | Control total |
| developer | ✓ Sí | ✗ No | Solo propias |
| viewer | ✗ No | ✗ No | Solo lectura |

### Permisos por Rol - Eliminar Tarea
| Rol | Propia | Ajena |
|-----|--------|-------|
| project_admin | ✓ Sí | ✓ Sí |
| developer | ✓ Sí | ✗ No |
| viewer | ✗ No | ✗ No |

---

## Validaciones Implementadas

### Backend
- ✓ Validación de entrada (título no vacío, longitud)
- ✓ Validación de autenticación (token JWT)
- ✓ Validación de membresía en proyecto
- ✓ Validación de permisos ABAC
- ✓ Validación de existencia de recursos

### Frontend
- ✓ Validación de campos requeridos
- ✓ Validación de longitud mínima
- ✓ Confirmación antes de eliminar
- ✓ Manejo de errores con mensajes al usuario
- ✓ Deshabilitación de botones durante envío

---

## Auditoría Registrada

**Eventos Capturados**:
1. **task.created**: Cuando se crea una tarea exitosamente
   - Información: taskId, projectId, taskTitle

2. **task.updated**: Cuando se actualiza una tarea exitosamente
   - Información: taskId, projectId, taskTitle

3. **task.deleted**: Cuando se elimina una tarea exitosamente
   - Información: taskId, projectId, taskTitle

4. **task.unauthorized_access**: Cuando se intenta acceso no autorizado
   - Información: taskId, projectId, action (GET/POST/PUT/DELETE), reason

**Datos Registrados Siempre**:
- userId: Quién realiza la acción
- ip: Dirección IP de la solicitud
- userAgent: Navegador/cliente usado
- timestamp: Cuándo ocurrió

---

## Resumen de Archivos Modificados/Creados

### Backend
- ✅ `src/models/membership.model.js` - Nuevo
- ✅ `src/models/tarea.model.js` - Modificado (agregado projectId)
- ✅ `src/middleware/checkPermission.js` - Nuevo (ABAC)
- ✅ `src/middleware/auditMiddleware.js` - Nuevo
- ✅ `src/services/auditLog.service.js` - Mejorado
- ✅ `src/models/auditLog.model.js` - Mejorado
- ✅ `src/controllers/task.controller.js` - Nuevo
- ✅ `src/routes/projects.js` - Nuevo
- ✅ `src/app.js` - Modificado

### Frontend
- ✅ `frontend/src/pages/Project.jsx` - Nuevo
- ✅ `frontend/src/services/projectService.js` - Nuevo

---

## Próximos Pasos (No Implementados Aún)

- [ ] Componente TaskCard mejorado
- [ ] Filtros y búsqueda de tareas
- [ ] Asignación de tareas a usuarios
- [ ] Comentarios en tareas
- [ ] Historial de cambios de tarea
- [ ] Dashboard de estadísticas
- [ ] Exportar tareas a CSV

---

## Conclusión

Se ha implementado un sistema completo de proyectos y tareas con:
- ✓ Control de acceso basado en atributos (ABAC)
- ✓ Auditoría completa de operaciones
- ✓ Validación robusta de permisos
- ✓ Frontend reactivo y responsive
- ✓ Manejo de errores completo
