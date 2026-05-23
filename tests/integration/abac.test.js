const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const Usuario = require('../../src/models/usuario.model');
const Organization = require('../../src/models/organization.model');
const Tarea = require('../../src/models/tarea.model');
const Membership = require('../../src/models/membership.model');

let mongoServer;

// Función auxiliar para crear un token JWT
const createToken = (usuarioId) => {
  return jwt.sign(
    { id: usuarioId },
    process.env.JWT_SECRET || 'tu-secreto-seguro',
    { expiresIn: '1h' }
  );
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Usuario.deleteMany();
  await Organization.deleteMany();
  await Tarea.deleteMany();
  await Membership.deleteMany();
});

describe('🔐 ATTRIBUTE-BASED ACCESS CONTROL (ABAC) - Tareas por Proyecto', () => {

  let admin, developer, viewer;
  let adminToken, developerToken, viewerToken;
  let project;
  let adminTask, developerTask;

  beforeEach(async () => {
    // Crear usuarios
    admin = await Usuario.create({
      email: 'admin@example.com',
      password: 'password123',
      rol: 'user'
    });
    
    developer = await Usuario.create({
      email: 'developer@example.com',
      password: 'password123',
      rol: 'user'
    });
    
    viewer = await Usuario.create({
      email: 'viewer@example.com',
      password: 'password123',
      rol: 'user'
    });

    // Crear tokens
    adminToken = createToken(admin._id);
    developerToken = createToken(developer._id);
    viewerToken = createToken(viewer._id);

    // Crear organización/proyecto
    project = await Organization.create({
      nombre: 'Proyecto Seguro',
      descripcion: 'Proyecto para probar ABAC',
      creador: admin._id
    });

    // Crear membresías
    await Membership.create({
      userId: admin._id,
      projectId: project._id,
      role: 'project_admin'
    });

    await Membership.create({
      userId: developer._id,
      projectId: project._id,
      role: 'developer'
    });

    await Membership.create({
      userId: viewer._id,
      projectId: project._id,
      role: 'viewer'
    });

    // Crear tareas
    adminTask = await Tarea.create({
      title: 'Tarea del Admin',
      completed: false,
      usuarioId: admin._id,
      projectId: project._id
    });

    developerTask = await Tarea.create({
      title: 'Tarea del Developer',
      completed: false,
      usuarioId: developer._id,
      projectId: project._id
    });
  });

  // ===== CRITERIO 1: viewer puede leer tareas del proyecto =====
  test('✅ CRITERIO 1: viewer puede LEER tareas del proyecto', async () => {
    const res = await request(app)
      .get(`/api/tareas/${adminTask._id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body._id).toBe(adminTask._id.toString());
    expect(res.body.title).toBe('Tarea del Admin');
  });

  // ===== CRITERIO 2: viewer NO puede crear tareas =====
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

  // ===== CRITERIO 3: developer puede editar su propia tarea =====
  test('✅ CRITERIO 3: developer puede EDITAR su propia tarea → 200', async () => {
    const res = await request(app)
      .put(`/api/tareas/${developerTask._id}`)
      .set('Authorization', `Bearer ${developerToken}`)
      .send({
        title: 'Tarea del Developer - Actualizada',
        completed: true
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Tarea del Developer - Actualizada');
    expect(res.body.completed).toBe(true);
  });

  // ===== CRITERIO 4: developer NO puede editar tarea ajena =====
  test('✅ CRITERIO 4: developer NO puede EDITAR tarea de otro → 403 Forbidden', async () => {
    const res = await request(app)
      .put(`/api/tareas/${adminTask._id}`)
      .set('Authorization', `Bearer ${developerToken}`)
      .send({
        title: 'Intento de editar tarea del admin',
        completed: true
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('No tienes permiso');
  });

  // ===== CRITERIO 5: project_admin puede editar cualquier tarea =====
  test('✅ CRITERIO 5: project_admin puede EDITAR cualquier tarea → 200', async () => {
    const res = await request(app)
      .put(`/api/tareas/${developerTask._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Tarea del Developer - Editada por Admin',
        completed: true
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Tarea del Developer - Editada por Admin');
    expect(res.body.completed).toBe(true);
  });

  // ===== PRUEBAS ADICIONALES =====

  test('viewer NO puede editar tareas', async () => {
    const res = await request(app)
      .put(`/api/tareas/${developerTask._id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Intento de editar desde viewer',
        completed: true
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('No tienes permiso');
  });

  test('project_admin puede leer todas las tareas', async () => {
    const res = await request(app)
      .get(`/api/tareas/${developerTask._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Tarea del Developer');
  });

  test('developer puede leer tareas del proyecto', async () => {
    const res = await request(app)
      .get(`/api/tareas/${adminTask._id}`)
      .set('Authorization', `Bearer ${developerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Tarea del Admin');
  });

  test('usuario sin membresía NO puede acceder a tareas del proyecto', async () => {
    // Crear otro usuario sin membresía
    const otherUser = await Usuario.create({
      email: 'outsider@example.com',
      password: 'password123',
      rol: 'user'
    });
    const otherToken = createToken(otherUser._id);

    const res = await request(app)
      .get(`/api/tareas/${adminTask._id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.statusCode).toBe(403);
  });

  test('project_admin puede crear tareas en el proyecto', async () => {
    const res = await request(app)
      .post('/api/tareas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Tarea creada por Admin',
        projectId: project._id.toString()
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Tarea creada por Admin');
  });

  test('developer puede crear tareas en el proyecto', async () => {
    const res = await request(app)
      .post('/api/tareas')
      .set('Authorization', `Bearer ${developerToken}`)
      .send({
        title: 'Tarea creada por Developer',
        projectId: project._id.toString()
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Tarea creada por Developer');
  });

  test('Membresía con índice compuesto único previene duplicados', async () => {
    // Intentar crear una segunda membresía para el mismo usuario en el mismo proyecto
    try {
      await Membership.create({
        userId: developer._id,
        projectId: project._id,
        role: 'viewer'
      });
      // Si llegamos aquí, el índice no funcionó
      expect(true).toBe(false); // Forzar fallo
    } catch (err) {
      // Esperamos un error de índice único
      expect(err.code).toBe(11000); // Código de error de duplicado MongoDB
    }
  });

  test('Verificar atributos de ABAC: userId, projectId, role', async () => {
    const membership = await Membership.findOne({
      userId: developer._id,
      projectId: project._id
    });

    expect(membership).toBeDefined();
    expect(membership.userId.toString()).toBe(developer._id.toString());
    expect(membership.projectId.toString()).toBe(project._id.toString());
    expect(membership.role).toBe('developer');
  });

  test('Métodos de Membership funcionan correctamente', async () => {
    const membership = await Membership.findOne({
      userId: developer._id,
      projectId: project._id
    });

    // Probar métodos
    expect(membership.hasRole('developer')).toBe(true);
    expect(membership.hasRole('project_admin')).toBe(false);
    expect(membership.isAdmin()).toBe(false);
    expect(membership.canWrite()).toBe(true);
    expect(membership.canRead()).toBe(true);

    // Probar rol viewer
    const viewerMembership = await Membership.findOne({
      userId: viewer._id,
      projectId: project._id
    });

    expect(viewerMembership.isAdmin()).toBe(false);
    expect(viewerMembership.canWrite()).toBe(false);
    expect(viewerMembership.canRead()).toBe(true);
  });
});
