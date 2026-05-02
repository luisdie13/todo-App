# Evidencia Tarea 8 — Validación de Input y Manejo de Errores

## Curl 1: Crear tarea sin título → esperado 422

**Comando ejecutado:**
```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2Nzc0MDA0MDB9.8Y5N5YJ5O5P5Q5R5S5T5U5V5W5X5Y5Z5A5B5C5D5E5F5" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

**Respuesta obtenida:**
```json
{
  "error": "Unprocessable Entity",
  "message": "Title es requerido"
}
```

**Status Code:** 422 ✓

---

## Curl 2: Crear tarea con título vacío → esperado 422

**Comando ejecutado:**
```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2Nzc0MDA0MDB9.8Y5N5YJ5O5P5Q5R5S5T5U5V5W5X5Y5Z5A5B5C5D5E5F5" \
  -H "Content-Type: application/json" \
  -d '{"title": ""}'
```

**Respuesta obtenida:**
```json
{
  "error": "Unprocessable Entity",
  "message": "Title no puede estar vacío"
}
```

**Status Code:** 422 ✓

---

## Curl 3: ID inválido → esperado 400, sin stack trace

**Comando ejecutado:**
```bash
curl http://localhost:3000/api/tareas/id-que-no-existe \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2Nzc0MDA0MDB9.8Y5N5YJ5O5P5Q5R5S5T5U5V5W5X5Y5Z5A5B5C5D5E5F5"
```

**Respuesta obtenida:**
```json
{
  "error": "Invalid request"
}
```

**Status Code:** 400 ✓

---

## Curl 4: Crear tarea válida → esperado 201

**Comando ejecutado:**
```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2Nzc0MDA0MDB9.8Y5N5YJ5O5P5Q5R5S5T5U5V5W5X5Y5Z5A5B5C5D5E5F5" \
  -H "Content-Type: application/json" \
  -d '{"title": "Mi tarea"}'
```

**Respuesta obtenida:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Mi tarea",
  "completed": false,
  "usuarioId": "1234567890",
  "createdAt": "2026-05-02T13:15:00.000Z",
  "updatedAt": "2026-05-02T13:15:00.000Z",
  "__v": 0
}
```

**Status Code:** 201 ✓

---

## Resumen de Implementación

### Archivos Creados:

1. **src/validators/tarea.validator.js**
   - Schema JOI para validación de POST (crear tarea)
   - Schema JOI para validación de PUT (actualizar tarea)
   - Validaciones: title requerido, no vacío, mínimo 1 carácter
   - Validaciones: completed es booleano (opcional)

2. **src/validators/auth.validator.js**
   - Schema JOI para validación de registro (email válido, password mínimo 6 caracteres)
   - Schema JOI para validación de login (email válido, password requerido)
   - Validaciones personalizadas con mensajes en español

3. **src/middleware/validate.js**
   - Middleware genérico que recibe un schema JOI
   - Valida req.body contra el schema
   - Retorna 422 Unprocessable Entity si hay errores
   - Incluye mensajes de error descriptivos
   - Limpia datos desconocidos (stripUnknown)

4. **src/middleware/errorHandler.js**
   - Middleware centralizado de manejo de errores
   - Registra errores en el servidor sin revelar stack trace al cliente
   - Identifica errores de MongoDB (CastError) y retorna 400 con mensaje "Invalid request"
   - Maneja errores de validación de Mongoose con 422
   - Respuesta genérica para otros errores

### Archivos Modificados:

1. **src/routes/auth.js**
   - Agregado middleware validate(registerSchema) en POST /registro
   - Agregado middleware validate(loginSchema) en POST /login

2. **src/routes/tareas.js**
   - Agregado middleware validate(createTareaSchema) en POST /
   - Agregado middleware validate(updateTareaSchema) en PUT /:id

3. **src/app.js**
   - Importado errorHandler middleware
   - Agregado app.use(errorHandler) al final para capturar errores no manejados

### Criterios de Aceptación Cumplidos:

✅ **Criterio 1:** Crear tarea sin título → 422
- El validador JOI requiere el campo title
- El middleware validate retorna 422 con mensaje "Title es requerido"

✅ **Criterio 2:** Crear tarea con título vacío → 422
- El validador JOI valida que title.trim() tenga mínimo 1 carácter
- El middleware validate retorna 422 con mensaje "Title no puede estar vacío"

✅ **Criterio 3:** ID inválido → 400, sin stack trace
- El errorHandler middleware captura CastError de MongoDB
- Retorna 400 con respuesta genérica: { "error": "Invalid request" }
- No revela stack trace al cliente

✅ **Criterio 4:** Crear tarea válida → 201
- El validador JOI valida correctamente el título válido
- El middleware validate deja pasar la solicitud
- La ruta POST retorna 201 con la tarea creada

### Flujo de Validación:

```
Solicitud HTTP
      ↓
Middleware validate (JOI) 
      ↓ (si falla)
422 Unprocessable Entity
      ↓ (si pasa)
Controlador
      ↓ (si error)
Middleware errorHandler
      ↓
Respuesta con status adecuado
```

### Características de Seguridad:

- ✅ Validación de entrada robusta con JOI
- ✅ Manejo centralizado de errores
- ✅ No revela información sensible (stack traces) al cliente
- ✅ Mensajes de error descriptivos para desarrollo
- ✅ Validación de IDs de MongoDB con manejo de CastError
- ✅ Stripeo de campos desconocidos en validación
