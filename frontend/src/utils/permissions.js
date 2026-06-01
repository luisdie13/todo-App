/**
 * Utilidad para determinar permisos en el frontend
 * Basado en roles de membresía en proyectos
 */

/**
 * Determina si un usuario puede leer una tarea
 * @param {Object} usuario - Usuario actual
 * @param {Object} tarea - Tarea a verificar
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @returns {Boolean}
 */
export const canReadTask = (usuario, tarea, membership) => {
  if (!usuario) return false;

  // Super admin puede leer cualquier tarea
  if (usuario.rol === 'super_admin') return true;

  // Sin membresía, no puede leer
  if (!membership) return false;

  // Todos los roles pueden leer (project_admin, developer, viewer)
  return ['project_admin', 'developer', 'viewer'].includes(membership.role);
};

/**
 * Determina si un usuario puede crear una tarea
 * @param {Object} usuario - Usuario actual
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @param {Object} proyecto - Proyecto actual
 * @returns {Boolean}
 */
export const canCreateTask = (usuario, membership, proyecto) => {
  if (!usuario) return false;

  // Super admin puede crear tareas en cualquier proyecto
  if (usuario.rol === 'super_admin') return true;

  // Proyecto archivado: no se pueden crear tareas
  if (proyecto && proyecto.estado === 'archivado') return false;

  // Sin membresía, no puede crear
  if (!membership) return false;

  // Solo project_admin y developer pueden crear
  return ['project_admin', 'developer'].includes(membership.role);
};

/**
 * Determina si un usuario puede editar una tarea
 * @param {Object} usuario - Usuario actual
 * @param {Object} tarea - Tarea a verificar
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @param {Object} proyecto - Proyecto actual
 * @returns {Boolean}
 */
export const canEditTask = (usuario, tarea, membership, proyecto) => {
  if (!usuario) return false;

  // Super admin puede editar cualquier tarea
  if (usuario.rol === 'super_admin') return true;

  // Proyecto archivado: no se pueden editar tareas
  if (proyecto && proyecto.estado === 'archivado') return false;

  // Sin membresía, no puede editar
  if (!membership) return false;

  // project_admin puede editar cualquier tarea
  if (membership.role === 'project_admin') return true;

  // developer puede editar solo sus propias tareas
  if (membership.role === 'developer') {
    return tarea.usuarioId === usuario.id;
  }

  // viewer no puede editar
  return false;
};

/**
 * Determina si un usuario puede eliminar una tarea
 * @param {Object} usuario - Usuario actual
 * @param {Object} tarea - Tarea a verificar
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @param {Object} proyecto - Proyecto actual
 * @returns {Boolean}
 */
export const canDeleteTask = (usuario, tarea, membership, proyecto) => {
  if (!usuario) return false;

  // Super admin puede eliminar cualquier tarea
  if (usuario.rol === 'super_admin') return true;

  // Proyecto archivado: no se pueden eliminar tareas
  if (proyecto && proyecto.estado === 'archivado') return false;

  // Sin membresía, no puede eliminar
  if (!membership) return false;

  // Solo project_admin puede eliminar
  return membership.role === 'project_admin';
};

/**
 * Determina si un usuario puede marcar una tarea como completada
 * @param {Object} usuario - Usuario actual
 * @param {Object} tarea - Tarea a verificar
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @param {Object} proyecto - Proyecto actual
 * @returns {Boolean}
 */
export const canMarkDone = (usuario, tarea, membership, proyecto) => {
  if (!usuario) return false;

  // Super admin puede marcar cualquier tarea como done
  if (usuario.rol === 'super_admin') return true;

  // Proyecto archivado: no se pueden marcar tareas como done
  if (proyecto && proyecto.estado === 'archivado') return false;

  // Sin membresía, no puede marcar como done
  if (!membership) return false;

  // project_admin puede marcar cualquier tarea como done
  if (membership.role === 'project_admin') return true;

  // developer y assignee pueden marcar solo sus propias tareas como done
  if (membership.role === 'developer') {
    // Si la tarea tiene assignee, solo el assignee puede marcar como done
    if (tarea.assignee && tarea.assignee._id) {
      return tarea.assignee._id === usuario.id;
    }
    // Si no hay assignee, el propietario puede marcar como done
    return tarea.usuarioId === usuario.id;
  }

  // viewer no puede marcar como done
  return false;
};

/**
 * Determina si un usuario puede editar un proyecto
 * @param {Object} usuario - Usuario actual
 * @param {Object} proyecto - Proyecto a verificar
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @returns {Boolean}
 */
export const canEditProject = (usuario, proyecto, membership) => {
  if (!usuario) return false;

  // Super admin puede editar cualquier proyecto
  if (usuario.rol === 'super_admin') return true;

  // Proyecto archivado: no se puede editar
  if (proyecto && proyecto.estado === 'archivado') return false;

  // Creador del proyecto puede editarlo
  if (proyecto && proyecto.creador === usuario.id) return true;

  // project_admin puede editar
  if (membership && membership.role === 'project_admin') return true;

  return false;
};

/**
 * Determina si un usuario puede ver botones de administración
 * @param {Object} usuario - Usuario actual
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @returns {Boolean}
 */
export const isAdmin = (usuario, membership) => {
  if (!usuario) return false;

  // Super admin es siempre admin
  if (usuario.rol === 'super_admin') return true;

  // project_admin es admin en el proyecto
  return membership && membership.role === 'project_admin';
};

/**
 * Determina si un usuario es solo viewer
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @returns {Boolean}
 */
export const isViewer = (membership) => {
  return membership && membership.role === 'viewer';
};

/**
 * Determina si un usuario puede ver auditoría
 * @param {Object} usuario - Usuario actual
 * @returns {Boolean}
 */
export const canViewAudit = (usuario) => {
  if (!usuario) return false;
  return usuario.rol === 'super_admin';
};

/**
 * Obtiene el nivel de permisos como texto
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @returns {String}
 */
export const getPermissionLevel = (membership) => {
  if (!membership) return 'ninguno';
  
  const roleLabels = {
    project_admin: 'Administrador',
    developer: 'Desarrollador',
    viewer: 'Visualizador'
  };

  return roleLabels[membership.role] || 'desconocido';
};

/**
 * Determina qué acciones puede realizar un usuario en una tarea
 * @param {Object} usuario - Usuario actual
 * @param {Object} tarea - Tarea a verificar
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @param {Object} proyecto - Proyecto actual
 * @returns {Object} Objeto con booleanos para cada acción
 */
export const getTaskActions = (usuario, tarea, membership, proyecto) => {
  return {
    read: canReadTask(usuario, tarea, membership),
    create: canCreateTask(usuario, membership, proyecto),
    edit: canEditTask(usuario, tarea, membership, proyecto),
    delete: canDeleteTask(usuario, tarea, membership, proyecto),
    markDone: canMarkDone(usuario, tarea, membership, proyecto)
  };
};

/**
 * Determina qué acciones puede realizar un usuario en un proyecto
 * @param {Object} usuario - Usuario actual
 * @param {Object} proyecto - Proyecto a verificar
 * @param {Object} membership - Membresía del usuario en el proyecto
 * @returns {Object} Objeto con booleanos para cada acción
 */
export const getProjectActions = (usuario, proyecto, membership) => {
  return {
    edit: canEditProject(usuario, proyecto, membership),
    isAdmin: isAdmin(usuario, membership),
    isViewer: isViewer(membership),
    isArchived: proyecto && proyecto.estado === 'archivado'
  };
};
