import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * usePermissions Hook — Core Client-Side ABAC Enforcement Engine.
 * Enforces technical guidelines:
 * - Solves identity alignment issues by using authoritative MongoDB mapping references (_id).
 * - Implements Rule 4 governance criteria by locking mutations if a project is 'archived'.
 * - Controls localized context permission states before sending payload streams to Axios.
 */
export const usePermissions = () => {
  const { user } = useContext(AuthContext);

  // Authoritative identity reference extractor
  const getUserId = () => user?._id || user?.id || null;

  /**
   * isOrgAdmin — Evaluates if the actor holds administrative metrics over an organization perimeter.
   */
  const isOrgAdmin = (organization) => {
    const currentUserId = getUserId();
    if (!currentUserId || !organization) return false;
    
    // Explicit organization owner validation
    const ownerId = organization.ownerId?._id || organization.ownerId || organization.orgOwnerId;
    if (ownerId && String(ownerId) === String(currentUserId)) {
      return true;
    }
    
    // Scan structure arrays for explicit org_admin properties flags
    if (organization.members && Array.isArray(organization.members)) {
      return organization.members.some(m => {
        const memberUserId = m.userId?._id || m.userId;
        return String(memberUserId) === String(currentUserId) && 
               (m.role === 'org_admin' || m.role === 'admin');
      });
    }
    
    return false;
  };

  /**
   * isProjectAdmin — Evaluates project-level administrative rights.
   */
  const isProjectAdmin = (project) => {
    const currentUserId = getUserId();
    if (!currentUserId || !project) return false;
    
    // Explicit project creator/owner validation
    const ownerId = project.ownerId?._id || project.ownerId || project.creatorId || project.creator?._id;
    if (ownerId && String(ownerId) === String(currentUserId)) {
      return true;
    }
    
    // Membership array verification layer
    if (project.members && Array.isArray(project.members)) {
      return project.members.some(m => {
        const memberUserId = m.userId?._id || m.userId;
        return String(memberUserId) === String(currentUserId) && m.role === 'project_admin';
      });
    }
    
    return false;
  };

  /**
   * isTaskAssignee — Asserts if the logged user matches the operational assignee profile.
   */
  const isTaskAssignee = (task) => {
    const currentUserId = getUserId();
    if (!currentUserId || !task) return false;
    
    const assigneeId = task.assigneeId || task.assignee?._id || task.assignee;
    return assigneeId && String(assigneeId) === String(currentUserId);
  };

  /**
   * isTaskCreator — Asserts if the user is the original creator of the task model asset.
   */
  const isTaskCreator = (task) => {
    const currentUserId = getUserId();
    if (!currentUserId || !task) return false;
    
    const creatorId = task.reporterId || task.userId?._id || task.userId || task.usuarioId?._id || task.usuarioId;
    return creatorId && String(creatorId) === String(currentUserId);
  };

  /**
   * canEditTask — Subject to Rule 4 constraints. 
   * Actions are blocked natively if the parent project metadata contains status === 'archived'.
   */
  const canEditTask = (task, project) => {
    if (!task) return false;
    
    // Rule 4 Compliance Check: Archived perimeters deny structural state mutations
    if (project?.status === 'archived') return false;
    
    if (isTaskCreator(task)) return true;
    if (isTaskAssignee(task)) return true;
    if (project && isProjectAdmin(project)) return true;
    
    return false;
  };

  /**
   * canDeleteTask — Restricted to project admins or task owners under active states.
   */
  const canDeleteTask = (task, project) => {
    if (!task) return false;
    
    // Rule 4 Protection Layer
    if (project?.status === 'archived') return false;
    
    if (isTaskCreator(task)) return true;
    if (project && isProjectAdmin(project)) return true;
    
    return false;
  };

  /**
   * canCreateTask — Evaluates membership arrays to confirm assignment authorizations.
   */
  const canCreateTask = (project) => {
    const currentUserId = getUserId();
    if (!currentUserId || !project) return false;
    
    // Rule 4 Protection Layer: Locked projects deny new task additions
    if (project.status === 'archived') return false;
    
    if (isProjectAdmin(project)) return true;
    
    if (project.members && Array.isArray(project.members)) {
      const member = project.members.find(m => {
        const memberUserId = m.userId?._id || m.userId;
        return String(memberUserId) === String(currentUserId);
      });
      
      if (member && (member.role === 'developer' || member.role === 'project_admin')) {
        return true;
      }
    }
    
    return false;
  };

  /**
   * canArchiveProject — Restricts status adjustments to authorized context roles.
   */
  const canArchiveProject = (project) => {
    return isProjectAdmin(project);
  };

  /**
   * canArchiveOrganization — Validates context metrics before triggering organization lockouts.
   */
  const canArchiveOrganization = (organization) => {
    return isOrgAdmin(organization);
  };

  /**
   * canDeleteOrganization — Reserved exclusively for the supreme structural owner.
   */
  const canDeleteOrganization = (organization) => {
    const currentUserId = getUserId();
    if (!currentUserId || !organization) return false;
    
    const ownerId = organization.ownerId?._id || organization.ownerId || organization.orgOwnerId;
    return ownerId && String(ownerId) === String(currentUserId);
  };

  /**
   * canDeleteProject — Restricts full project drops to database owners.
   */
  const canDeleteProject = (project) => {
    const currentUserId = getUserId();
    if (!currentUserId || !project) return false;
    
    const ownerId = project.ownerId?._id || project.ownerId || project.creatorId;
    return ownerId && String(ownerId) === String(currentUserId);
  };

  /**
   * canInviteMember — Restricts resource invitations parameters.
   */
  const canInviteMember = (organization) => {
    return isOrgAdmin(organization);
  };

  /**
   * canEditComment — Enforces comment ownership validations.
   */
  const canEditComment = (comment, project) => {
    const currentUserId = getUserId();
    if (!currentUserId || !comment) return false;
    
    // Rule 4 Compliance Check: Locked projects block comment mutations
    if (project?.status === 'archived') return false;
    
    const authorId = comment.authorId?._id || comment.authorId || comment.userId || comment.usuarioId;
    return authorId && String(authorId) === String(currentUserId);
  };

  /**
   * canDeleteComment — Validates comment drop permissions.
   */
  const canDeleteComment = (comment, project) => {
    const currentUserId = getUserId();
    if (!currentUserId || !comment) return false;
    
    // Rule 4 Compliance Check: Locked projects block comment destruction processes
    if (project?.status === 'archived') return false;
    
    const authorId = comment.authorId?._id || comment.authorId || comment.userId || comment.usuarioId;
    const isCommentOwner = authorId && String(authorId) === String(currentUserId);
    
    // Context privilege backup: project admins can also drop comments within active boards
    const isBoardAdmin = project && isProjectAdmin(project);
    
    return isCommentOwner || isBoardAdmin;
  };

  /**
   * canCreateProject — Restricts sub-context deployment properties inside the organization boundary.
   */
  const canCreateProject = (organization) => {
    return isOrgAdmin(organization);
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