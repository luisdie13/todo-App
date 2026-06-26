/**
 * Frontend ABAC permission utilities.
 *
 * Mirrors the server-side ABAC policies so the UI can conditionally render
 * controls before the request is made.  These are soft guards only —
 * the authoritative enforcement always happens on the backend.
 *
 * User object shape (decoded JWT):  { id, email, role }
 * Membership shape:                 { role: 'project_admin' | 'developer' | 'viewer' }
 * Project shape:                    { status: 'active' | 'archived' }
 */

// ── Helpers ────────────────────────────────────────────────────────────────

const isSuperAdmin   = (user) => user?.role === 'super_admin';
const isProjectAdmin = (membership) => membership?.role === 'project_admin';
const isDeveloper    = (membership) => membership?.role === 'developer';

/** Returns true if the project is archived (no mutations allowed). */
const isArchived = (project) => project?.status === 'archived';

// ══════════════════════════════════════════════════════════════════════════
// Task permissions
// ══════════════════════════════════════════════════════════════════════════

/**
 * Determines whether the user may read a given task.
 * All project members (project_admin, developer, viewer) can read.
 */
export const canReadTask = (user, task, membership) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (!membership) return false;
  return ['project_admin', 'developer', 'viewer'].includes(membership.role);
};

/**
 * Determines whether the user may create tasks in the project.
 * Viewers are explicitly excluded.
 */
export const canCreateTask = (user, membership, project) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isArchived(project)) return false;
  if (!membership) return false;
  return ['project_admin', 'developer'].includes(membership.role);
};

/**
 * Determines whether the user may edit a task.
 * - project_admin can edit any task.
 * - developer can only edit tasks they own.
 * - viewer cannot edit.
 */
export const canEditTask = (user, task, membership, project) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isArchived(project)) return false;
  if (!membership) return false;
  if (isProjectAdmin(membership)) return true;
  if (isDeveloper(membership)) {
    // Support both populated userId and flat userId field
    const ownerId = task?.userId?._id || task?.userId;
    return String(ownerId) === String(user.id);
  }
  return false;
};

/**
 * Determines whether the user may delete a task.
 * Only project_admin (and super_admin) may delete tasks.
 */
export const canDeleteTask = (user, task, membership, project) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isArchived(project)) return false;
  if (!membership) return false;
  return isProjectAdmin(membership);
};

/**
 * Determines whether the user may mark a task as completed.
 * - project_admin can mark any task.
 * - developer can mark only their assigned (or owned) tasks.
 */
export const canMarkDone = (user, task, membership, project) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isArchived(project)) return false;
  if (!membership) return false;
  if (isProjectAdmin(membership)) return true;
  if (isDeveloper(membership)) {
    const assigneeId = task?.assignee?._id || task?.assignee;
    if (assigneeId) return String(assigneeId) === String(user.id);
    const ownerId = task?.userId?._id || task?.userId;
    return String(ownerId) === String(user.id);
  }
  return false;
};

/**
 * Determines whether the user may view the decrypted description of a
 * sensitive task.  Only the assigned user and project_admin are authorised.
 */
export const canViewSensitiveContent = (user, task, membership) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isProjectAdmin(membership)) return true;
  // Assignee check — supports populated or flat assignee field
  const assigneeId = task?.assignee?._id || task?.assignee;
  if (assigneeId && String(assigneeId) === String(user.id)) return true;
  return false;
};

// ══════════════════════════════════════════════════════════════════════════
// Project permissions
// ══════════════════════════════════════════════════════════════════════════

/**
 * Determines whether the user may edit project metadata.
 */
export const canEditProject = (user, project, membership) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isArchived(project)) return false;
  const ownerId = project?.ownerId?._id || project?.ownerId;
  if (ownerId && String(ownerId) === String(user.id)) return true;
  return isProjectAdmin(membership);
};

// ══════════════════════════════════════════════════════════════════════════
// Role classification helpers
// ══════════════════════════════════════════════════════════════════════════

/** Returns true when the user holds the project_admin or super_admin role. */
export const isAdmin = (user, membership) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return isProjectAdmin(membership);
};

/** Returns true when the user is a read-only viewer in this project. */
export const isViewer = (membership) => membership?.role === 'viewer';

/** Returns true when the user can access global audit functionality. */
export const canViewAudit = (user) => isSuperAdmin(user);

/**
 * Returns a human-readable label for the membership role.
 */
export const getPermissionLevel = (membership) => {
  const labels = {
    project_admin: 'Administrator',
    developer:     'Developer',
    viewer:        'Viewer'
  };
  return labels[membership?.role] ?? 'None';
};

/**
 * Convenience aggregate: returns all action flags for a task in one call.
 */
export const getTaskActions = (user, task, membership, project) => ({
  read:     canReadTask(user, task, membership),
  create:   canCreateTask(user, membership, project),
  edit:     canEditTask(user, task, membership, project),
  delete:   canDeleteTask(user, task, membership, project),
  markDone: canMarkDone(user, task, membership, project)
});

/**
 * Convenience aggregate: returns all action flags for a project in one call.
 */
export const getProjectActions = (user, project, membership) => ({
  edit:       canEditProject(user, project, membership),
  isAdmin:    isAdmin(user, membership),
  isViewer:   isViewer(membership),
  isArchived: isArchived(project)
});
