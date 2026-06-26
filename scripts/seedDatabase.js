/**
 * Seed Script para resetear la base de datos y crear usuarios de prueba
 * ESCENARIO FINAL DE EVALUACIÓN CON 9 USUARIOS Y 2 ORGANIZACIONES
 * Uso: node scripts/seedDatabase.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const Task = require('../src/models/task.model');
const Comment = require('../src/models/comment.model');
const Organization = require('../src/models/organization.model');
const Project = require('../src/models/project.model');
const Membership = require('../src/models/membership.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/todo_app';
const PASSWORD = 'Test1234!'; // Contraseña única para demo

async function seedDatabase() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a MongoDB');

    // Eliminar todas las colecciones
    console.log('\n🧹 Limpiando base de datos...');
    await mongoose.connection.dropDatabase();
    console.log('✅ Base de datos limpiada');

    // =============== CREAR USUARIOS (9 EN TOTAL) ===============
    console.log('\n👥 Creando 9 usuarios de prueba...');
    
    // Usuario 1: Super Admin
    const adminUser = new User({
      email: 'admin@todoapp.com',
      password: PASSWORD,
      role: 'super_admin'
    });
    await adminUser.save();
    console.log(`✅ Usuario 1 creado: ${adminUser.email} (super_admin)`);

    // Usuarios 2-8: Para Organización A
    const user2 = new User({
      email: 'user2@test.com',
      password: PASSWORD,
      role: 'user'
    });
    await user2.save();
    console.log(`✅ Usuario 2 creado: ${user2.email} (role: user)`);

    const user3 = new User({
      email: 'user3@test.com',
      password: PASSWORD,
      role: 'user'
    });
    await user3.save();
    console.log(`✅ Usuario 3 creado: ${user3.email} (role: user)`);

    const user4 = new User({
      email: 'user4@test.com',
      password: PASSWORD,
      role: 'user'
    });
    await user4.save();
    console.log(`✅ Usuario 4 creado: ${user4.email} (role: user)`);

    const user5 = new User({
      email: 'user5@test.com',
      password: PASSWORD,
      role: 'user',
      isActive: false // CUENTA DESACTIVADA
    });
    await user5.save();
    console.log(`✅ Usuario 5 creado: ${user5.email} (role: user, isActive: false)`);

    const user6 = new User({
      email: 'user6@test.com',
      password: PASSWORD,
      role: 'user'
    });
    await user6.save();
    console.log(`✅ Usuario 6 creado: ${user6.email} (role: user)`);

    const user7 = new User({
      email: 'user7@test.com',
      password: PASSWORD,
      role: 'user'
    });
    await user7.save();
    console.log(`✅ Usuario 7 creado: ${user7.email} (role: user)`);

    const user8 = new User({
      email: 'user8@test.com',
      password: PASSWORD,
      role: 'user'
    });
    await user8.save();
    console.log(`✅ Usuario 8 creado: ${user8.email} (role: user)`);

    // Usuario 9: Para Organización B
    const user9 = new User({
      email: 'external@test.com',
      password: PASSWORD,
      role: 'user'
    });
    await user9.save();
    console.log(`✅ Usuario 9 creado: ${user9.email} (role: user)`);

    // =============== CREAR ORGANIZACIÓN A (MAIN CORP) ===============
    console.log('\n🏢 Creando Organización A "Main Corp"...');
    
    const orgA = new Organization({
      name: 'Main Corp',
      description: 'Organización principal para la evaluación',
      ownerId: user2._id,
      members: [
        { userId: user2._id, role: 'org_admin' },
        { userId: user3._id, role: 'org_admin' },
        { userId: user4._id, role: 'member' },
        { userId: user5._id, role: 'member' },
        { userId: user6._id, role: 'member' },
        { userId: user7._id, role: 'member' },
        { userId: user8._id, role: 'member' }
      ]
    });
    await orgA.save();
    console.log(`✅ Organización A creada: ${orgA.name}`);
    console.log(`   - Owner: ${user2.email}`);
    console.log(`   - Org Admins: ${user2.email}, ${user3.email}`);
    console.log(`   - Miembros: ${user4.email}, ${user5.email} (inactive), ${user6.email}, ${user7.email}, ${user8.email}`);

    // =============== CREAR PROYECTOS EN ORGANIZACIÓN A ===============
    console.log('\n📊 Creando proyectos para Organización A...');
    
     // Proyecto 1: Internal, Active
     const project1 = new Project({
       name: 'Project 1 - Internal Active',
       description: 'Proyecto interno activo para validar permisos',
       organizationId: orgA._id,
       ownerId: user2._id,
       status: 'active',
       visibility: 'internal'
     });
    await project1.save();
    console.log(`✅ Proyecto 1 creado: ${project1.name} (estado: activo)`);

    // Agregar membresías del Proyecto 1
    const mem1_1 = new Membership({
      userId: user2._id,
      projectId: project1._id,
      role: 'project_admin'
    });
    await mem1_1.save();

    const mem1_2 = new Membership({
      userId: user6._id,
      projectId: project1._id,
      role: 'developer'
    });
    await mem1_2.save();

    const mem1_3 = new Membership({
      userId: user7._id,
      projectId: project1._id,
      role: 'developer'
    });
    await mem1_3.save();

    const mem1_4 = new Membership({
      userId: user8._id,
      projectId: project1._id,
      role: 'viewer'
    });
    await mem1_4.save();

    console.log(`   - project_admin: ${user2.email}`);
    console.log(`   - developers: ${user6.email}, ${user7.email}`);
    console.log(`   - viewer: ${user8.email}`);

    // Proyecto 2: Private, Active
    const project2 = new Project({
      name: 'Project 2 - Private Active',
      description: 'Proyecto privado solo accesible por project_admin',
      organizationId: orgA._id,
      ownerId: user2._id,
      status: 'active',
      visibility: 'private'
    });
    await project2.save();
    console.log(`✅ Proyecto 2 creado: ${project2.name} (estado: activo)`);

    // Solo user2 como project_admin
    const mem2_1 = new Membership({
      userId: user2._id,
      projectId: project2._id,
      role: 'project_admin'
    });
    await mem2_1.save();
    console.log(`   - project_admin: ${user2.email}`);

    // Proyecto 3: Internal, Archived
    const project3 = new Project({
      name: 'Project 3 - Internal Archived',
      description: 'Proyecto archivado para validar restricciones',
      organizationId: orgA._id,
      ownerId: user2._id,
      status: 'archived',
      visibility: 'internal'
    });
    await project3.save();
    console.log(`✅ Proyecto 3 creado: ${project3.name} (estado: archivado)`);

    const mem3_1 = new Membership({
      userId: user2._id,
      projectId: project3._id,
      role: 'project_admin'
    });
    await mem3_1.save();
    console.log(`   - project_admin: ${user2.email}`);

    // =============== CREAR ORGANIZACIÓN B (EXTERNAL CORP) ===============
    console.log('\n🏢 Creando Organización B "External Corp"...');
    
    const orgB = new Organization({
      name: 'External Corp',
      description: 'Organización externa para validar aislamiento',
      ownerId: user9._id,
      members: [
        { userId: user9._id, role: 'org_admin' }
      ]
    });
    await orgB.save();
    console.log(`✅ Organización B creada: ${orgB.name}`);
    console.log(`   - Owner: ${user9.email}`);

    // =============== CREAR TAREAS EN PROYECTO 1 ===============
    console.log('\n📝 Creando tareas para Proyecto 1...');

    // Tarea 1: Normal (sin cifrar)
    const task1 = new Task({
      title: 'Tarea 1 - Normal Task',
      description: 'Esta es una tarea normal sin información sensible',
      sensitive: false,
      userId: user6._id,
      assignee: user6._id,
      projectId: project1._id,
      status: 'backlog'
    });
    await task1.save();
    console.log(`✅ Tarea 1 creada: ${task1.title} (sensitive: false)`);

    // Tarea 2: Sensible (cifrada)
    const task2 = new Task({
      title: 'Tarea 2 - Sensitive Task',
      description: 'Información confidencial que será cifrada automáticamente',
      sensitive: true,
      userId: user6._id,
      assignee: user6._id,
      projectId: project1._id,
      status: 'backlog'
    });
    await task2.save();
    console.log(`✅ Tarea 2 creada: ${task2.title} (sensitive: true, descripción cifrada)`);

    // =============== RESUMEN FINAL ===============
    console.log('\n' + '='.repeat(70));
    console.log('✨ SEED COMPLETADO EXITOSAMENTE!');
    console.log('='.repeat(70));
    
    console.log('\n📋 CREDENCIALES Y ESTRUCTURA CREADA:');
    
    console.log('\n👤 USUARIOS (9 EN TOTAL):');
    console.log('\n  1. Super Admin:');
    console.log('     Email: admin@todoapp.com');
    console.log('     Password: Test1234!');
    console.log('     Rol Global: super_admin');
    
    console.log('\n  2-8. Usuarios para Organización A (Main Corp):');
    console.log('     Email: user2@test.com | Rol Global: user | Rol Org: org_admin');
    console.log('     Email: user3@test.com | Rol Global: user | Rol Org: org_admin');
    console.log('     Email: user4@test.com | Rol Global: user | Rol Org: member');
    console.log('     Email: user5@test.com | Rol Global: user | Rol Org: member | isActive: FALSE ⚠️');
    console.log('     Email: user6@test.com | Rol Global: user | Rol Org: member');
    console.log('     Email: user7@test.com | Rol Global: user | Rol Org: member');
    console.log('     Email: user8@test.com | Rol Global: user | Rol Org: member');
    console.log('     Password (todas): Test1234!');
    
    console.log('\n  9. Usuario para Organización B (External Corp):');
    console.log('     Email: external@test.com');
    console.log('     Password: Test1234!');
    console.log('     Rol Global: user');
    console.log('     Rol Org: org_admin (dueño de External Corp)');

    console.log('\n🏢 ORGANIZACIONES:');
    console.log('\n  Organización A: Main Corp');
    console.log(`     ID: ${orgA._id}`);
    console.log(`     Owner: user2@test.com`);
    console.log(`     Members: user2, user3 (org_admin) | user4, user5, user6, user7, user8 (member)`);

    console.log('\n  Organización B: External Corp');
    console.log(`     ID: ${orgB._id}`);
    console.log(`     Owner: external@test.com`);
    console.log(`     Members: external@test.com (org_admin)`);

    console.log('\n📊 PROYECTOS (En Organización A):');
    console.log(`\n  1. Project 1 - Internal Active`);
    console.log(`     ID: ${project1._id}`);
    console.log(`     Estado: activo`);
    console.log(`     Owner: user2@test.com`);
    console.log(`     Membresía: user2 (project_admin) | user6, user7 (developer) | user8 (viewer)`);

    console.log(`\n  2. Project 2 - Private Active`);
    console.log(`     ID: ${project2._id}`);
    console.log(`     Estado: activo`);
    console.log(`     Owner: user2@test.com`);
    console.log(`     Membresía: user2 (project_admin) SOLO`);

    console.log(`\n  3. Project 3 - Internal Archived`);
    console.log(`     ID: ${project3._id}`);
    console.log(`     Estado: archivado`);
    console.log(`     Owner: user2@test.com`);
    console.log(`     Membresía: user2 (project_admin)`);

    console.log('\n🧪 ESCENARIOS DE PRUEBA RECOMENDADOS:');
    console.log('\n  1. Login con user2@test.com (org_admin de Main Corp)');
    console.log('     - DEBE ver botón "+ Nuevo Proyecto" ✅');
    console.log('     - DEBE poder crear proyectos ✅');
    console.log('     - DEBE ver los 3 proyectos ✅');
    
    console.log('\n  2. Login con user5@test.com (cuenta desactivada)');
    console.log('     - No DEBE poder acceder al sistema (validar isActive) ❌');
    
    console.log('\n  3. Login con user8@test.com (viewer de Proyecto 1)');
    console.log('     - NO DEBE ver botón "+ Nuevo Proyecto" ❌');
    console.log('     - NO DEBE poder crear tareas en proyecto 1 ❌');
    
    console.log('\n  4. Login con external@test.com (Admin de External Corp)');
    console.log('     - DEBE ver botón "+ Nuevo Proyecto" ✅');
    console.log('     - NO DEBE ver proyectos de Main Corp ❌');
    console.log('     - DEBE poder crear proyectos en External Corp ✅');

    console.log('\n' + '='.repeat(70));
    console.log('🎯 DEMO LISTA PARA EVALUACIÓN');
    console.log('='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante seed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

seedDatabase();
