import api from '../config/axios.config';

/**
 * projectService — API client middleware managing project boundaries and task lifecycles.
 *
 * Requirements Met:
 * - Migrated fully to centralized Axios wrapper (`api`) to retain dynamic sliding-window token rotation tracking.
 * - Aligns operational route contexts perfectly with backend models and frontend components specifications.
 * - Propagates rich network exception layers to power rate-limiting counters (Class 9).
 */

/**
 * getMyProjects — Retrieves all projects where the active user context has explicit membership.
 */
export const getMyProjects = async () => {
  try {
    const response = await api.get('/projects');
    return {
      success: true,
      projects: response.data?.projects || response.data || [],
      total: response.data?.total || 0
    };
  } catch (err) {
    console.error('[projectService] Failed to fetch active project index list:', err.message);
    return {
      success: false,
      status: err.response?.status || 500,
      retryAfter: err.response?.headers['retry-after'] || null,
      error: err.response?.data?.error || 'Failed to load project parameters contexts.'
    };
  }
};

/**
 * getProject — Retrieves detailed specification records for a unique project ID perimeter.
 * @param {string} projectId 
 */
export const getProject = async (projectId) => {
  try {
    const response = await api.get(`/projects/${projectId}`);
    return {
      success: true,
      project: response.data?.project || response.data,
      userRole: response.data?.userRole || response.data?.role || null
    };
  } catch (err) {
    console.error('[projectService] Project metadata lookup sequence failed:', err.message);
    return {
      success: false,
      status: err.response?.status || 500,
      error: err.response?.data?.error || 'Access Denied: Project record not found.'
    };
  }
};

/**
 * getProjectTasks — Queries all structural task models bound to a given project scope.
 * @param {string} projectId 
 */
export const getProjectTasks = async (projectId) => {
  try {
    const response = await api.get(`/projects/${projectId}/tasks`);
    return {
      success: true,
      // Fallback handlers to accept clean array nodes or polimorphic parameters models mapping
      tasks: response.data?.tasks || response.data?.tareas || response.data || [],
      total: response.data?.total || 0
    };
  } catch (err) {
    console.error('[projectService] Failed to sync project task repository listings:', err.message);
    return {
      success: false,
      status: err.response?.status || 500,
      error: err.response?.data?.error || 'Failed to sync task registries records.'
    };
  }
};

/**
 * createTask — Provisions a new task payload asset inside MongoDB.
 * @param {string} projectId 
 * @param {Object} taskData — Contains { title, description, priority, status, assigneeId, dueDate, sensitive }
 */
export const createTask = async (projectId, taskData) => {
  try {
    const response = await api.post(`/projects/${projectId}/tasks`, {
      title: taskData.title?.trim(),
      description: taskData.description?.trim() || null,
      priority: taskData.priority || 'medium',
      status: taskData.status || 'backlog',
      assigneeId: taskData.assigneeId || null,
      dueDate: taskData.dueDate || null,
      sensitive: taskData.sensitive || false
    });
    return {
      success: true,
      task: response.data?.task || response.data?.tarea || response.data
    };
  } catch (err) {
    console.error('[projectService] Task provisioning request rejected by backend:', err.message);
    return {
      success: false,
      status: err.response?.status || 500,
      retryAfter: err.response?.headers['retry-after'] || err.response?.data?.retryAfter || null,
      error: err.response?.data?.error || 'Failed to deploy fresh task asset specification.',
      validationErrors: err.response?.data?.errors || null
    };
  }
};

/**
 * getTask — Retrieves a unique task dataset registry.
 * @param {string} taskId 
 */
export const getTask = async (taskId) => {
  try {
    const response = await api.get(`/tasks/${taskId}`);
    return {
      success: true,
      task: response.data?.task || response.data?.tarea || response.data
    };
  } catch (err) {
    console.error('[projectService] Unique task validation fetch failure:', err.message);
    return {
      success: false,
      status: err.response?.status || 500,
      error: err.response?.data?.error || 'Target task registry records unreachable.'
    };
  }
};

/**
 * updateTask — Mutates task configurations, statuses flags, and parameters assignments.
 * @param {string} taskId 
 * @param {Object} taskData 
 */
export const updateTask = async (taskId, taskData) => {
  try {
    // Aligned strictly to correct backend flat API route pathways: /api/tasks/:id
    const response = await api.put(`/tasks/${taskId}`, {
      title: taskData.title?.trim(),
      description: taskData.description?.trim() || null,
      priority: taskData.priority,
      status: taskData.status,
      assigneeId: taskData.assigneeId || null,
      dueDate: taskData.dueDate || null,
      sensitive: taskData.sensitive || false
    });
    return {
      success: true,
      task: response.data?.task || response.data?.tarea || response.data
    };
  } catch (err) {
    console.error('[projectService] Task modification payload sequence aborted:', err.message);
    return {
      success: false,
      status: err.response?.status || 500,
      retryAfter: err.response?.headers['retry-after'] || err.response?.data?.retryAfter || null,
      error: err.response?.data?.error || 'Failed to save task specifications adjustments.',
      validationErrors: err.response?.data?.errors || null
    };
  }
};

/**
 * deleteTask — Executes destruction of a task index record in MongoDB.
 * @param {string} taskId 
 */
export const deleteTask = async (taskId) => {
  try {
    const response = await api.delete(`/tasks/${taskId}`);
    return {
      success: true,
      message: response.data?.message || response.data?.mensaje || 'Task entity deleted successfully.'
    };
  } catch (err) {
    console.error('[projectService] Destructive task delete action rejected:', err.message);
    return {
      success: false,
      status: err.response?.status || 500,
      error: err.response?.data?.error || 'Destruction sequence denied: Operational constraint active.'
    };
  }
};

const projectService = {
  getMyProjects,
  getProject,
  getProjectTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask
};

export default projectService;