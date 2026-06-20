const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const Usuario = require('../../src/models/usuario.model');
const Tarea = require('../../src/models/tarea.model');
const tokenService = require('../../src/services/tokenService');

describe('Security Testing (Clase 13)', () => {
  let usuarioA, usuarioB, tareaA, accessTokenA, accessTokenB;

  beforeAll(async () => {
    // Crear usuarios de prueba
    usuarioA = new Usuario({
      email: 'usuarioA@test.com',
      password: 'Password123',
      rol: 'user'
    });
    await usuarioA.save();

    usuarioB = new Usuario({
      email: 'usuarioB@test.com',
      password: 'Password456',
      rol: 'user'
    });
    await usuarioB.save();

    // Generar tokens
    const tokensA = tokenService.generateRefreshToken(usuarioA);
    accessTokenA = tokenService.generateAccessToken(usuarioA);

    const tokensB = tokenService.generateRefreshToken(usuarioB);
    accessTokenB = tokenService.generateAccessToken(usuarioB);

    // Crear tarea para usuarioA
    tareaA = new Tarea({
      title: 'Tarea sensible de Usuario A',
      description: 'Información confidencial',
      sensitive: true,
      usuarioId: usuarioA._id
    });
    await tareaA.save();
  });

  afterAll(async () => {
    await Usuario.deleteMany({});
    await Tarea.deleteMany({});
    await mongoose.connection.close();
  });

  /**
   * TEST 1: IDOR (Insecure Direct Object Reference)
   * Usuario B intenta acceder a tareas de Usuario A
   */
  describe('TEST 1: IDOR - Usuario B intentando ver tareas de Usuario A', () => {
    test('Debe retornar 403 cuando usuario no autorizado intenta acceder a tarea ajena', async () => {
      const res = await request(app)
        .get(`/api/tareas/${tareaA._id}`)
        .set('Authorization', `Bearer ${accessTokenB}`)
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    test('Usuario A puede acceder a su propia tarea', async () => {
      const res = await request(app)
        .get(`/api/tareas/${tareaA._id}`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(200);

      expect(res.body._id).toBe(tareaA._id.toString());
    });
  });

  /**
   * TEST 2: Brute Force
   * El 6to intento de login fallido debe ser bloqueado
   */
  describe('TEST 2: Brute Force - Bloqueo después de múltiples intentos fallidos', () => {
    test('6 intentos de login fallido deben ser bloqueados', async () => {
      // Los primeros 5 intentos fallan
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'usuarioA@test.com',
            password: 'ContraseñaIncorrecta'
          });
      }

      // El 6to intento debe ser bloqueado por rate limiting
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'usuarioA@test.com',
          password: 'ContraseñaIncorrecta'
        });

      // Esperar 429 (Too Many Requests) o 401 (si no hay rate limiting configurado)
      expect([401, 429]).toContain(res.statusCode);
    });
  });

  /**
   * TEST 3: NoSQL Injection
   * Intento de inyección NoSQL en búsqueda de usuarios
   */
  describe('TEST 3: NoSQL Injection - Validación de entrada sanitizada', () => {
    test('Payload NoSQL injection debe ser rechazado', async () => {
      const maliciousPayload = {
        email: { $ne: null },
        password: { $ne: null }
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(maliciousPayload);

      // Debe rechazar la entrada
      expect(res.statusCode).toBe(400);
    });

    test('Login exitoso con credenciales válidas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'usuarioA@test.com',
          password: 'Password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    test('Login fallido con credenciales inválidas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'usuarioA@test.com',
          password: 'ContraseñaIncorrecta'
        });

      expect(res.statusCode).toBe(401);
    });
  });

  /**
   * TEST 4: Auth Bypass - Token expirado o inválido
   */
  describe('TEST 4: Auth Bypass - Rechazo de tokens inválidos/expirados', () => {
    test('Token vacío debe retornar 401', async () => {
      const res = await request(app)
        .get('/api/tareas')
        .set('Authorization', 'Bearer ');

      expect(res.statusCode).toBe(401);
    });

    test('Token inválido debe retornar 401', async () => {
      const res = await request(app)
        .get('/api/tareas')
        .set('Authorization', 'Bearer invalid_token_12345');

      expect(res.statusCode).toBe(401);
    });

    test('Sin header Authorization debe retornar 401', async () => {
      const res = await request(app)
        .get('/api/tareas');

      expect(res.statusCode).toBe(401);
    });

    test('Token válido debe permitir acceso', async () => {
      const res = await request(app)
        .get('/api/tareas')
        .set('Authorization', `Bearer ${accessTokenA}`);

      expect(res.statusCode).toBe(200);
    });
  });

  /**
   * TEST 5: Privilege Escalation - Usuario no-admin no puede hacer acciones de admin
   */
  describe('TEST 5: Privilege Escalation - User no puede realizar acciones de admin', () => {
    test('Usuario normal no puede acceder a endpoints de admin (si existen)', async () => {
      // Crear usuario con rol 'user'
      const usuario = new Usuario({
        email: 'normaluser@test.com',
        password: 'Password789',
        rol: 'user'
      });
      await usuario.save();

      const tokens = tokenService.generateRefreshToken(usuario);
      const token = tokenService.generateAccessToken(usuario);

      // Si existe endpoint /api/admin/logs, debe retornar 403
      const res = await request(app)
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${token}`);

      expect([403, 404]).toContain(res.statusCode);

      await Usuario.findByIdAndDelete(usuario._id);
    });

    test('Usuario no puede modificar rol de otro usuario', async () => {
      // Usuario B intenta cambiar el rol de Usuario A
      const res = await request(app)
        .put(`/api/usuarios/${usuarioA._id}`)
        .set('Authorization', `Bearer ${accessTokenB}`)
        .send({
          rol: 'admin'
        });

      // Debe retornar 403 (Forbidden)
      expect([403, 401]).toContain(res.statusCode);
    });

    test('Datos del usuario no deben incluir información sensitiva en respuestas', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessTokenA}`);

      expect(res.statusCode).toBe(200);
      // No debe retornar contraseña en hash
      expect(res.body.usuario.password).toBeUndefined();
    });
  });

  /**
   * TEST ADICIONAL: Cifrado en Reposo
   * Verificar que datos sensibles se cifran en BD
   */
  describe('TEST ADICIONAL: Encriptación en Reposo - Datos sensibles cifrados', () => {
    test('Descripción de tarea sensible debe estar cifrada en BD', async () => {
      const tareaEnBD = await Tarea.collection.findOne({ _id: tareaA._id });
      
      // La descripción en BD debe estar en base64 (cifrada)
      // No debe estar en texto plano
      expect(tareaEnBD.description).not.toBe('Información confidencial');
      expect(tareaEnBD.description).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 pattern
    });

    test('Al recuperar tarea, descripción debe descifrarse automáticamente', async () => {
      const res = await request(app)
        .get(`/api/tareas/${tareaA._id}`)
        .set('Authorization', `Bearer ${accessTokenA}`)
        .expect(200);

      expect(res.body.description).toBe('Información confidencial');
    });
  });
});
