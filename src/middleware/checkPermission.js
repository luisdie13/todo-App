const Membership = require('../models/membership.model');
const Task = require('../models/task.model');
const Organization = require('../models/organization.model');

/**
 * Verifies if a user can read a task based on their role in the project
 * Returns true if:
 * - The user is project_admin of the project
 * - The user is developer or viewer of the project
 * @param {Object} user - Authenticated user (req.user)
 * @param {Object} task - Task to verify
 * @returns {Promise<Boolean>}
 */
const canReadTask = async (user, task) => {
  try {
    // DEFENSIVE PROTECTION: Validate that userId exists
    if (!task.userId) {
      console.error('ERROR: task.userId is undefined in canReadTask');
      return false;
    }
    // If the user is the task owner, they can read it
    const taskOwnerId = task.userId.toString?.() || task.userId;
    if (taskOwnerId === user.id) {
      return true;
    }

    // Si la tarea tiene un projectId, verificar membresía
    if (task.projectId) {
      const membership = await Membership.findOne({
        userId: user.id,
        projectId: task.projectId
      });

      if (membership && membership.canRead()) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error en canReadTask:', err);
    return false;
  }
};

/**
 * Verifies if a user can edit a task based on their role in the project
 * Returns true if:
 * - The user is project_admin of the project
 * - The user is developer AND is the task owner
 * @param {Object} user - Authenticated user (req.user)
 * @param {Object} task - Task to verify
 * @returns {Promise<Boolean>}
 */
const canEditTask = async (user, task) => {
  try {
    // DEFENSIVE PROTECTION: Validate that userId exists
    if (!task.userId) {
      console.error('ERROR: task.userId is undefined in canEditTask');
      return false;
    }
    
    // If the task doesn't have projectId, use original logic (owner)
    if (!task.projectId) {
      const taskOwnerId = task.userId.toString?.() || task.userId;
      return taskOwnerId === user.id;
    }

    // Check membership in the project
    const membership = await Membership.findOne({
      userId: user.id,
      projectId: task.projectId
    });

    if (!membership) {
      return false;
    }

    // project_admin can edit any task
    if (membership.isAdmin()) {
      return true;
    }

    // developer can only edit their own tasks
    if (membership.hasRole('developer')) {
      const taskOwnerId = task.userId.toString?.() || task.userId;
      return taskOwnerId === user.id;
    }

    // viewer cannot edit
    return false;
  } catch (err) {
    console.error('Error in canEditTask:', err);
    return false;
  }
};

/**
 * Verifies if a user can create a task in a project
 * Returns true if:
 * - The user is project_admin of the project
 * - The user is developer of the project
 * @param {Object} user - Authenticated user (req.user)
 * @param {String} projectId - Project ID
 * @returns {Promise<Boolean>}
 */
const canCreateTask = async (user, projectId) => {
  try {
    if (!projectId) {
      // If no projectId, any authenticated user can create tasks
      return true;
    }

    const membership = await Membership.findOne({
      userId: user.id,
      projectId: projectId
    });

    if (!membership) {
      return false;
    }

    // Only project_admin and developer can create tasks
    return membership.canWrite();
  } catch (err) {
    console.error('Error in canCreateTask:', err);
    return false;
  }
};

/**
 * Middleware that verifies task read permissions
 * Usage: router.get('/:id', checkReadPermission, handler)
 */
const checkReadPermission = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

     const hasPermission = await canReadTask(req.user, task);

    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to access this task' });
    }

    // Save the task in req for later use
    req.task = task;
    next();
  } catch (err) {
    console.error('Error in checkReadPermission:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware that verifies task edit permissions
 * Usage: router.put('/:id', checkEditPermission, handler)
 */
const checkEditPermission = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasPermission = await canEditTask(req.user, task);

    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to update this task' });
    }

    // Save the task in req for later use
    req.task = task;
    next();
  } catch (err) {
    console.error('Error in checkEditPermission:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware that verifies task creation permissions
 * Usage: router.post('/', checkCreatePermission, handler)
 */
const checkCreatePermission = async (req, res, next) => {
  try {
    const projectId = req.body.projectId;
    const hasPermission = await canCreateTask(req.user, projectId);

    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create tasks in this project' });
    }

    next();
  } catch (err) {
    console.error('Error in checkCreatePermission:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  canReadTask,
  canEditTask,
  canCreateTask,
  checkReadPermission,
  checkEditPermission,
  checkCreatePermission
};
