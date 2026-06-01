/**
 * Motor ABAC (Attribute-Based Access Control)
 * 
 * Proporciona un sistema flexible de control de acceso basado en atributos:
 * - usuario (rol global, permisos especiales)
 * - recurso (tipo, estado, propietario)
 * - contexto (acción solicitada, organización, proyecto)
 * 
 * Las políticas se definen como funciones que retornan true/false
 */

const Membership = require('../models/membership.model');
const Project = require('../models/project.model');
const Usuario = require('../models/usuario.model');

/**
 * Contexto ABAC - información completa para evaluación de políticas
 */
class ABACContext {
  constructor({
    usuario,
    recurso,
    accion,
    organizacion = null,
    proyecto = null,
    recursoId = null
  }) {
    this.usuario = usuario; // req.usuario
    this.recurso = recurso; // 'task', 'project', 'organization'
    this.accion = accion; // 'read', 'create', 'update', 'delete', 'mark_done'
    this.organizacion = organizacion;
    this.proyecto = proyecto;
    this.recursoId = recursoId;
  }
}

/**
 * Motor ABAC - evalúa políticas
 */
class ABACEngine {
  constructor() {
    this.policies = new Map();
    this.registerDefaultPolicies();
  }

  /**
   * Registra una política
   * @param {String} key - Identificador único (ej: "task.read")
   * @param {Function} evaluator - Función que retorna true si se permite
   */
  registerPolicy(key, evaluator) {
    this.policies.set(key, evaluator);
  }

  /**
   * Evalúa si una acción está permitida
   * @param {ABACContext} context - Contexto para evaluación
   * @returns {Promise<Boolean>}
   */
  async evaluate(context) {
    const policyKey = `${context.recurso}.${context.accion}`;
    
    if (!this.policies.has(policyKey)) {
      console.warn(`No policy found for: ${policyKey}`);
      return false;
    }

    try {
      const policy = this.policies.get(policyKey);
      return await policy(context);
    } catch (err) {
      console.error(`Error evaluating policy ${policyKey}:`, err);
      return false;
    }
  }

  /**
   * Registra todas las políticas por defecto
   */
  registerDefaultPolicies() {
    // ===== POLÍTICAS DE TAREAS =====
    this.registerPolicy('task.read', async (ctx) => {
      const { usuario, proyecto, recursoId } = ctx;

      // Super admin puede leer cualquier tarea
      if (usuario.rol === 'super_admin') return true;

      // Si no hay proyecto, solo el propietario puede leer
      if (!proyecto) return false;

      // Si el proyecto está archivado, solo lectura es permitida
      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      if (!membership) return false;

      // Todos los roles pueden leer (project_admin, developer, viewer)
      return membership.canRead();
    });

    this.registerPolicy('task.create', async (ctx) => {
      const { usuario, proyecto } = ctx;

      // Super admin puede crear tareas en cualquier proyecto
      if (usuario.rol === 'super_admin') return true;

      // Sin proyecto, solo usuarios autenticados pueden crear
      if (!proyecto) return true;

      // Proyecto archivado: no se pueden crear tareas
      if (proyecto.estado === 'archivado') return false;

      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      if (!membership) return false;

      // Solo project_admin y developer pueden crear
      return membership.canWrite();
    });

    this.registerPolicy('task.update', async (ctx) => {
      const { usuario, proyecto, recurso: tarea } = ctx;

      // Super admin puede actualizar cualquier tarea
      if (usuario.rol === 'super_admin') return true;

      // Proyecto archivado: no se pueden actualizar tareas
      if (proyecto && proyecto.estado === 'archivado') return false;

      // Sin proyecto, solo el propietario puede actualizar
      if (!proyecto) {
        return tarea.usuarioId.toString() === usuario.id;
      }

      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      if (!membership) return false;

      // project_admin puede editar cualquier tarea
      if (membership.isAdmin()) return true;

      // developer solo puede editar sus propias tareas
      if (membership.hasRole('developer')) {
        return tarea.usuarioId.toString() === usuario.id;
      }

      // viewer no puede actualizar
      return false;
    });

    this.registerPolicy('task.delete', async (ctx) => {
      const { usuario, proyecto, recurso: tarea } = ctx;

      // Super admin puede eliminar cualquier tarea
      if (usuario.rol === 'super_admin') return true;

      // Proyecto archivado: no se pueden eliminar tareas
      if (proyecto && proyecto.estado === 'archivado') return false;

      // Sin proyecto, solo el propietario puede eliminar
      if (!proyecto) {
        return tarea.usuarioId.toString() === usuario.id;
      }

      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      if (!membership) return false;

      // Solo project_admin puede eliminar
      return membership.isAdmin();
    });

    this.registerPolicy('task.mark_done', async (ctx) => {
      const { usuario, proyecto, recurso: tarea } = ctx;

      // Super admin puede marcar cualquier tarea como done
      if (usuario.rol === 'super_admin') return true;

      // Proyecto archivado: no se pueden marcar tareas como done
      if (proyecto && proyecto.estado === 'archivado') return false;

      // Sin proyecto, solo el propietario puede marcar como done
      if (!proyecto) {
        return tarea.usuarioId.toString() === usuario.id;
      }

      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      if (!membership) return false;

      // project_admin puede marcar cualquier tarea como done
      if (membership.isAdmin()) return true;

      // developer y assignee pueden marcar solo sus propias tareas como done
      if (membership.hasRole('developer')) {
        // Si la tarea tiene assignee, solo el assignee puede marcar como done
        if (tarea.assignee) {
          return tarea.assignee.toString() === usuario.id;
        }
        // Si no hay assignee, el propietario puede marcar como done
        return tarea.usuarioId.toString() === usuario.id;
      }

      // viewer no puede marcar como done
      return false;
    });

    // ===== POLÍTICAS DE PROYECTOS =====
    this.registerPolicy('project.read', async (ctx) => {
      const { usuario, proyecto } = ctx;

      // Super admin puede leer cualquier proyecto
      if (usuario.rol === 'super_admin') return true;

      if (!proyecto) return false;

      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      if (membership) return true;

      // Creador del proyecto puede leerlo
      if (proyecto.creador.toString() === usuario.id) return true;

      return false;
    });

    this.registerPolicy('project.update', async (ctx) => {
      const { usuario, proyecto } = ctx;

      // Super admin puede actualizar cualquier proyecto
      if (usuario.rol === 'super_admin') return true;

      if (!proyecto) return false;

      // Proyecto archivado: no se puede actualizar
      if (proyecto.estado === 'archivado') return false;

      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      // Solo project_admin puede actualizar
      if (membership && membership.isAdmin()) return true;

      // Creador del proyecto puede actualizarlo
      if (proyecto.creador.toString() === usuario.id) return true;

      return false;
    });

    this.registerPolicy('project.delete', async (ctx) => {
      const { usuario, proyecto } = ctx;

      // Super admin puede eliminar cualquier proyecto
      if (usuario.rol === 'super_admin') return true;

      if (!proyecto) return false;

      // Creador del proyecto puede eliminarlo
      return proyecto.creador.toString() === usuario.id;
    });

    this.registerPolicy('project.archive', async (ctx) => {
      const { usuario, proyecto } = ctx;

      // Super admin puede archivar cualquier proyecto
      if (usuario.rol === 'super_admin') return true;

      if (!proyecto) return false;

      // Verificar membresía
      const membership = await Membership.findOne({
        userId: usuario.id,
        projectId: proyecto._id
      });

      // Solo project_admin puede archivar
      if (membership && membership.isAdmin()) return true;

      // Creador del proyecto puede archivarlo
      return proyecto.creador.toString() === usuario.id;
    });

    // ===== POLÍTICAS DE AUDITORÍA =====
    this.registerPolicy('audit.read', async (ctx) => {
      const { usuario } = ctx;

      // Solo super_admin puede ver logs de auditoría
      return usuario.rol === 'super_admin';
    });

    this.registerPolicy('organization.view_members', async (ctx) => {
      const { usuario, organizacion } = ctx;

      // Super admin puede ver miembros de cualquier organización
      if (usuario.rol === 'super_admin') return true;

      if (!organizacion) return false;

      // Creador de la organización puede ver miembros
      if (organizacion.creador.toString() === usuario.id) return true;

      // Miembros de la organización pueden ver otros miembros
      return organizacion.miembros.some(m => m.usuario.toString() === usuario.id);
    });

    this.registerPolicy('organization.edit', async (ctx) => {
      const { usuario, organizacion } = ctx;

      // Super admin puede editar cualquier organización
      if (usuario.rol === 'super_admin') return true;

      if (!organizacion) return false;

      // Solo el creador de la organización puede editarla
      return organizacion.creador.toString() === usuario.id;
    });
  }
}

// Instancia global del motor ABAC
const abacEngine = new ABACEngine();

module.exports = {
  ABACContext,
  abacEngine
};
