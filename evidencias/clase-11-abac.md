# Clase 11: Attribute-Based Access Control (ABAC)

## Resumen de Implementación

Se ha implementado un sistema de **Attribute-Based Access Control (ABAC)** para controlar el acceso a tareas basándose en los atributos del usuario y su rol dentro de un proyecto/organización.

## Política Implementada

La política implementada utiliza **tres atributos principales**:
1. **userId**: Identificador del usuario autenticado
2. **projectId**: Proyecto/organización a la que pertenece la tarea
3. **role**: Rol del usuario dentro del proyecto (project_admin, developer, viewer)

Las decisiones de control de acceso se basan en:
- La **membresía** del usuario en el proyecto (tabla de relación `Membership`)
- El **rol** asignado al usuario en ese proyecto
- La **propiedad** de la tarea (solo para desarrolladores)

## Archivos Creados/Modificados

### 1. **src/models/membership.model.js** (Nuevo)
- Define el esquema de membresía con campos: `userId`, `projectId`, `role`
- Índice compuesto único `{userId: 1, projectId: 1}` para evitar duplicados
- Métodos de validación: `hasRole()`, `isAdmin()`, `canWrite()`, `canRead()`

### 2. **src/middleware/checkPermission.js** (Nuevo)
- Función `canReadTask(user, task)`: Verifica si el usuario puede leer una tarea
- Función `canEditTask(user, task)`: Verifica si el usuario puede editar una tarea
- Middleware `checkReadPermission`: Valida permisos antes de GET
- Middleware `checkEditPermission`: Valida permisos antes de PUT

### 3. **src/models/tarea.model.js** (Modificado)
- Agregado campo `projectId` para asociar tareas a proyectos

### 4. **src/routes/tareas.js** (Modificado)
- Aplicado `checkReadPermission` al endpoint GET `/:id`
- Aplicado `checkEditPermission` al endpoint PUT `/:id`

### 5. **tests/integration/abac.test.js** (Nuevo)
- Suite de pruebas completa con 20+ tests
- Verifica los 5 criterios de aceptación

---

## Criterios de Aceptación (Resultados)

### ✅ CRITERIO 1: viewer puede leer tareas del proyecto

**Comportamiento**: Un usuario con rol `viewer` en un proyecto puede leer cualquier tarea de ese proyecto.

**Test correspondiente**:
```javascript
test('✅ CRITERIO 1: viewer puede LEER tareas del proyecto', async () => {
  const res = await request(app)
    .get(`/api/tareas/${adminTask._id}`)
    .set('Authorization', `Bearer ${viewerToken}`);

  expect(res.statusCode).toBe(200);
  expect(res.body._id).toBe(adminTask._id.toString());
});
```

**Lógica ABAC**:
```
Si usuario.role == 'viewer' EN project:
  ✓ Permitir lectura de cualquier tarea del proyecto
```

---

### ✅ CRITERIO 2: viewer NO puede crear tareas

**Comportamiento**: Un usuario con rol `viewer` NO puede crear nuevas tareas en el proyecto.

**Test correspondiente**:
```javascript
test('✅ CRITERIO 2: viewer NO puede CREAR tareas → 403 Forbidden', async () => {
  const res = await request(app)
    .post('/api/tareas')
    .set('Authorization', `Bearer ${viewerToken}`)
    .send({
      title: 'Nueva tarea por viewer',
      projectId: project._id.toString()
    });

  expect(res.statusCode).toBe(403);
  expect(res.body.error).toContain('No tienes permiso');
});
```

**Lógica ABAC**:
```
Si usuario.role == 'viewer':
  ✗ Denegar creación (403 Forbidden)
  Mensaje: "No tienes permiso para crear tareas en este proyecto"
```

---

### ✅ CRITERIO 3: developer puede editar su propia tarea

**Comportamiento**: Un usuario con rol `developer` puede editar las tareas que él creó.

**Test correspondiente**:
```javascript
test('✅ CRITERIO 3: developer puede EDITAR su propia tarea → 200', async () => {
  const res = await request(app)
    .put(`/api/tareas/${developerTask._id}`)
    .set('Authorization', `Bearer ${developerToken}`)
    .send({
      title: 'Tarea actualizada',
      completed: true
    });

  expect(res.statusCode).toBe(200);
  expect(res.body.title).toBe('Tarea actualizada');
});
```

**Lógica ABAC**:
```
Si usuario.role == 'developer':
  Y tarea.usuarioId == usuario.id:
    ✓ Permitir edición
  Sino:
    ✗ Denegar (403 Forbidden)
```

---

### ✅ CRITERIO 4: developer NO puede editar tarea ajena

**Comportamiento**: Un usuario con rol `developer` NO puede editar tareas creadas por otros usuarios.

**Test correspondiente**:
```javascript
test('✅ CRITERIO 4: developer NO puede EDITAR tarea de otro → 403 Forbidden', async () => {
  const res = await request(app)
    .put(`/api/tareas/${adminTask._id}`)
    .set('Authorization', `Bearer ${developerToken}`)
    .send({
      title: 'Intento de editar',
      completed: true
    });

  expect(res.statusCode).toBe(403);
  expect(res.body.error).toContain('No tienes permiso');
});
```

**Lógica ABAC**:
```
Si usuario.role == 'developer':
  Y tarea.usuarioId != usuario.id:
    ✗ Denegar (403 Forbidden)
```

---

### ✅ CRITERIO 5: project_admin puede editar cualquier tarea del proyecto

**Comportamiento**: Un usuario con rol `project_admin` puede editar cualquier tarea del proyecto, sin importar quién la creó.

**Test correspondiente**:
```javascript
test('✅ CRITERIO 5: project_admin puede EDITAR cualquier tarea → 200', async () => {
  const res = await request(app)
    .put(`/api/tareas/${developerTask._id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'Editada por Admin',
      completed: true
    });

  expect(res.statusCode).toBe(200);
  expect(res.body.title).toBe('Editada por Admin');
});
```

**Lógica ABAC**:
```
Si usuario.role == 'project_admin':
  ✓ Permitir edición de CUALQUIER tarea del proyecto
```

---

## Implementación del Modelo de Seguridad

### Relaciones en la Base de Datos

```
Usuario 1 --- M Membresía
            project_admin
            developer
            viewer

Membresía M --- 1 Proyecto/Organization
        {userId: 1, projectId: 1} UNIQUE

Tarea M --- 1 Proyecto/Organization
Tarea M --- 1 Usuario (creador)
```

### Flujo de Validación (GET /api/tareas/:id)

```
1. Autenticación: ¿Token válido?
   NO → 401 Unauthorized

2. ¿La tarea existe?
   NO → 404 Not Found

3. ¿Usuario es propietario de la tarea?
   SÍ → 200 OK (permitir lectura)

4. ¿Tarea tiene projectId?
   NO → 403 Forbidden

5. ¿Existe membresía (userId, projectId)?
   NO → 403 Forbidden

6. ¿Usuario.role tiene permiso canRead()?
   (project_admin, developer, viewer = SÍ)
   NO → 403 Forbidden
   SÍ → 200 OK
```

### Flujo de Validación (PUT /api/tareas/:id)

```
1. Autenticación: ¿Token válido?
   NO → 401 Unauthorized

2. ¿La tarea existe?
   NO → 404 Not Found

3. ¿Tarea tiene projectId?
   NO → Verificar que usuario sea propietario
       SÍ → 200 OK (editar)
       NO → 403 Forbidden

4. ¿Existe membresía (userId, projectId)?
   NO → 403 Forbidden

5. ¿Usuario.role == 'project_admin'?
   SÍ → 200 OK (permitir edición)

6. ¿Usuario.role == 'developer' Y es propietario?
   SÍ → 200 OK
   NO → 403 Forbidden

7. (viewer no puede editar)
   → 403 Forbidden
```

---

## Metodología ABAC

El control de acceso se realiza comparando **atributos** en lugar de solo roles:

| Atributo | Tipo | Valores |
|----------|------|---------|
| `user.id` | String (ObjectId) | ID único del usuario |
| `user.role` | String | project_admin, developer, viewer |
| `task.projectId` | String (ObjectId) | ID del proyecto |
| `task.usuarioId` | String (ObjectId) | ID del creador de la tarea |
| `membership.role` | String | project_admin, developer, viewer |

**Ventajas de ABAC**:
- ✓ Granular: Control fino basado en múltiples atributos
- ✓ Flexible: Fácil de agregar nuevas reglas sin cambiar código
- ✓ Escalable: Funciona con múltiples proyectos y usuarios
- ✓ Auditable: Todas las decisiones están basadas en atributos específicos

---

## Pruebas Unitarias

Se ejecutan con: `npm test -- tests/integration/abac.test.js`

### Cobertura de Tests
- ✅ 5 criterios de aceptación
- ✅ Métodos de Membership (hasRole, isAdmin, canWrite, canRead)
- ✅ Índice compuesto único previene duplicados
- ✅ Usuarios sin membresía no pueden acceder
- ✅ Creación de tareas por diferentes roles
- ✅ Lectura de tareas por diferentes roles
- ✅ Edición de tareas por diferentes roles

---

## Cómo Probar Manualmente

1. **Iniciar el servidor**:
   ```bash
   npm start
   ```

2. **Ejecutar tests de ABAC**:
   ```bash
   npm test -- tests/integration/abac.test.js
   ```

3. **Usar curl (ejemplos)**:
   ```bash
   # Crear usuario viewer
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"viewer@test.com","password":"Pass123!"}'

   # Obtener token
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"viewer@test.com","password":"Pass123!"}'

   # Leer tarea (200 OK si es viewer)
   curl -X GET http://localhost:3000/api/tareas/{tareaId} \
     -H "Authorization: Bearer {token}"

   # Intentar crear tarea (403 Forbidden si es viewer)
   curl -X POST http://localhost:3000/api/tareas \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"title":"Nueva tarea","projectId":"{projectId}"}'
   ```

---

## Referencias

- **Modelo**: ABAC (Attribute-Based Access Control)
- **Implementación**: Middleware Express.js + MongoDB
- **Estándar**: RBAC + Atributos (userId, projectId, role)

---

## Conclusión

La implementación de ABAC proporciona un control de acceso seguro y flexible basado en atributos, asegurando que:
- Los usuarios solo pueden acceder a recursos que les corresponden
- Los permisos están claramente definidos por rol y proyecto
- El sistema es auditable y escalable
- Cumple con los 5 criterios de aceptación establecidos
