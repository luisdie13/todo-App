import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Hook personalizado para verificar permisos de usuario
 * Proporciona funciones para determinar qué acciones puede realizar el usuario
 * 
 * Retorna un objeto con métodos para verificar permisos:
 * - isOrgAdmin(organization): ¿Es administrador de la organización?
 * - isProjectAdmin(project): ¿Es administrador del proyecto?
 * - isTaskAssignee(task): ¿Está asignado a esta tarea?
 * - isTaskCreator(task): ¿Creó esta tarea?
 * - canEditTask(task, project): ¿Puede editar esta tarea?
 * - canDeleteTask(task): ¿Puede eliminar esta tarea?
 * - canCreateTask(project): ¿Puede crear tareas en este proyecto?
 * - canArchiveProject(project): ¿Puede archivar este proyecto?
 */
export const usePermissions = () => {
  const { user } = useContext(AuthContext);

  /**
   * Verifica si el usuario es administrador de una organización
   * @param {Object} organization - La organización a verificar
   * @returns {boolean}
   */
  const isOrgAdmin = (organization) => {
    if (!user || !organization) return false;
    
    // El creador de la organización es admin
    if (organization.ownerId === user.id || organization.ownerId?._id === user.id) {
      return true;
    }
    
    // Verificar si está en los miembros con rol org_admin
    if (organization.members && Array.isArray(organization.members)) {
      return organization.members.some(m => 
        (m.userId === user.id || m.userId?._id === user.id) && 
        (m.role === 'org_admin' || m.role === 'admin')
      );
    }
    
    return false;
  };

  /**
   * Verifica si el usuario es administrador de un proyecto
   * @param {Object} project - El proyecto a verificar
   * @returns {boolean}
   */
  const isProjectAdmin = (project) => {
    if (!user || !project) return false;
    
    // El creador del proyecto es admin
    if (project.ownerId === user.id || project.ownerId?._id === user.id) {
      return true;
    }
    
    // Verificar si está en los miembros con rol project_admin
    if (project.members && Array.isArray(project.members)) {
      return project.members.some(m => 
        (m.userId === user.id || m.userId?._id === user.id) && 
        m.role === 'project_admin'
      );
    }
    
    return false;
  };

  /**
   * Verifica si el usuario está asignado a una tarea
   * @param {Object} task - La tarea a verificar
   * @returns {boolean}
   */
  const isTaskAssignee = (task) => {
    if (!user || !task) return false;
    
    if (!task.assignee) return false;
    
    return task.assignee === user.id || task.assignee?._id === user.id;
  };

  /**
   * Verifica si el usuario es el creador de una tarea
   * @param {Object} task - La tarea a verificar
   * @returns {boolean}
   */
  const isTaskCreator = (task) => {
    if (!user || !task) return false;
    
    if (!task.usuarioId) return false;
    
    return task.usuarioId === user.id || task.usuarioId?._id === user.id;
  };

  /**
   * Verifica si el usuario puede editar una tarea
   * Puede editar si es: creador, asignado, o admin del proyecto
   * @param {Object} task - La tarea a verificar
   * @param {Object} project - El proyecto que contiene la tarea (opcional)
   * @returns {boolean}
   */
  const canEditTask = (task, project) => {
    if (!user || !task) return false;
    
    // Puede editar si es el creador
    if (isTaskCreator(task)) return true;
    
    // Puede editar si está asignado
    if (isTaskAssignee(task)) return true;
    
    // Puede editar si es admin del proyecto
    if (project && isProjectAdmin(project)) return true;
    
    return false;
  };

  /**
   * Verifica si el usuario puede eliminar una tarea
   * Solo el creador o admin del proyecto pueden eliminar
   * @param {Object} task - La tarea a verificar
   * @param {Object} project - El proyecto que contiene la tarea (opcional)
   * @returns {boolean}
   */
  const canDeleteTask = (task, project) => {
    if (!user || !task) return false;
    
    // El creador puede eliminar
    if (isTaskCreator(task)) return true;
    
    // El admin del proyecto puede eliminar
    if (project && isProjectAdmin(project)) return true;
    
    return false;
  };

   /**
     * Verifica si el usuario puede crear tareas en un proyecto
     * @param {Object} project - El proyecto a verificar
     * @returns {boolean}
     */
    const canCreateTask = (project) => {
      if (!user || !project) return false;
      
      // El admin del proyecto puede crear tareas
      if (isProjectAdmin(project)) return true;
      
      // El creador/owner del proyecto puede crear tareas
      if (project.ownerId === user.id || project.ownerId?._id === user.id) {
        return true;
      }
      
      // Los developers pueden crear tareas (buscar en project.members como fallback)
      // NOTA: Este es un fallback para casos donde project.members está poblado desde el frontend
      if (project.members && Array.isArray(project.members)) {
        const member = project.members.find(m => 
          m.userId === user.id || m.userId?._id === user.id
        );
        
        if (member && (member.role === 'developer' || member.role === 'project_admin')) {
          return true;
        }
      }
      
      // RESTRICCIÓN ESTRICTA: No permitir crear tareas sin verificar membresía explícita
      // El usuario DEBE ser project_admin, owner, o developer registrado en project.members
      // El backend hará la validación final como segunda línea de defensa
      return false;
    };

  /**
   * Verifica si el usuario puede archivar un proyecto
   * Solo el creador/admin pueden archivar
   * @param {Object} project - El proyecto a verificar
   * @returns {boolean}
   */
  const canArchiveProject = (project) => {
    if (!user || !project) return false;
    
    return isProjectAdmin(project);
  };

  /**
   * Verifica si el usuario puede archivar una organización
   * @param {Object} organization - La organización a verificar
   * @returns {boolean}
   */
  const canArchiveOrganization = (organization) => {
    if (!user || !organization) return false;
    
    return isOrgAdmin(organization);
  };

  /**
   * Verifica si el usuario puede eliminar una organización
   * @param {Object} organization - La organización a verificar
   * @returns {boolean}
   */
  const canDeleteOrganization = (organization) => {
    if (!user || !organization) return false;
    
    // Solo el dueño puede eliminar
    return organization.ownerId === user.id || organization.ownerId?._id === user.id;
  };

  /**
   * Verifica si el usuario puede eliminar un proyecto
   * @param {Object} project - El proyecto a verificar
   * @returns {boolean}
   */
  const canDeleteProject = (project) => {
    if (!user || !project) return false;
    
    // Solo el dueño puede eliminar
    return project.ownerId === user.id || project.ownerId?._id === user.id;
  };

  /**
   * Verifica si el usuario puede invitar miembros a una organización
   * @param {Object} organization - La organización a verificar
   * @returns {boolean}
   */
  const canInviteMember = (organization) => {
    if (!user || !organization) return false;
    
    return isOrgAdmin(organization);
  };

  /**
   * Verifica si el usuario puede editar comentarios (solo si es el creador)
   * @param {Object} comment - El comentario a verificar
   * @returns {boolean}
   */
  const canEditComment = (comment) => {
    if (!user || !comment) return false;
    
    return comment.usuarioId === user.id || comment.usuarioId?._id === user.id;
  };

   /**
    * Verifica si el usuario puede eliminar comentarios (si es el creador)
    * @param {Object} comment - El comentario a verificar
    * @returns {boolean}
    */
   const canDeleteComment = (comment) => {
     if (!user || !comment) return false;
     
     return comment.usuarioId === user.id || comment.usuarioId?._id === user.id;
   };

   /**
    * Verifica si el usuario puede crear proyectos en una organización
    * Solo org_admin o el dueño pueden crear proyectos
    * @param {Object} organization - La organización a verificar
    * @returns {boolean}
    */
   const canCreateProject = (organization) => {
     if (!user || !organization) return false;
     
     // El dueño puede crear proyectos
     if (organization.ownerId === user.id || organization.ownerId?._id === user.id) {
       return true;
     }
     
     // Los org_admin pueden crear proyectos
     if (organization.members && Array.isArray(organization.members)) {
       return organization.members.some(m => 
         (m.userId === user.id || m.userId?._id === user.id) && 
         m.role === 'org_admin'
       );
     }
     
     return false;
   };

   return {
    isOrgAdmin,
    isProjectAdmin,
    isTaskAssignee,
    isTaskCreator,
    canEditTask,
    canDeleteTask,
    canCreateTask,
    canArchiveProject,
    canArchiveOrganization,
    canDeleteOrganization,
    canDeleteProject,
    canInviteMember,
    canEditComment,
    canDeleteComment,
    canCreateProject
  };
};

export default usePermissions;
