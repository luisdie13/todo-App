import { getToken } from './tokenStorage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Obtiene la lista de "Mis Proyectos"
 * Incluye proyectos creados y proyectos donde el usuario es miembro
 */
export const getMyProjects = async () => {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No autenticado' };
    }

    const response = await fetch(`${API_URL}/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al obtener proyectos'
      };
    }

    const data = await response.json();
    return {
      success: true,
      projects: data.projects,
      total: data.total
    };
  } catch (err) {
    console.error('Error en getMyProjects:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Obtiene los detalles de un proyecto específico
 */
export const getProject = async (projectId) => {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No autenticado' };
    }

    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al obtener el proyecto'
      };
    }

    const data = await response.json();
    return {
      success: true,
      project: data.project,
      userRole: data.userRole
    };
  } catch (err) {
    console.error('Error en getProject:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Obtiene todas las tareas de un proyecto
 */
export const getProjectTasks = async (projectId) => {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No autenticado' };
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al obtener tareas'
      };
    }

    const data = await response.json();
    return {
      success: true,
      tareas: data.tareas,
      total: data.total
    };
  } catch (err) {
    console.error('Error en getProjectTasks:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Crea una nueva tarea en un proyecto
 */
export const createTask = async (projectId, taskData) => {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No autenticado' };
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: taskData.title,
        description: taskData.description || null
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al crear la tarea'
      };
    }

    const data = await response.json();
    return {
      success: true,
      tarea: data.tarea
    };
  } catch (err) {
    console.error('Error en createTask:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Obtiene una tarea específica
 */
export const getTask = async (projectId, taskId) => {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No autenticado' };
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al obtener la tarea'
      };
    }

    const data = await response.json();
    return {
      success: true,
      tarea: data
    };
  } catch (err) {
    console.error('Error en getTask:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Actualiza una tarea
 */
export const updateTask = async (projectId, taskId, taskData) => {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No autenticado' };
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: taskData.title,
        description: taskData.description || null,
        completed: taskData.completed || false
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al actualizar la tarea'
      };
    }

    const data = await response.json();
    return {
      success: true,
      tarea: data.tarea
    };
  } catch (err) {
    console.error('Error en updateTask:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Elimina una tarea
 */
export const deleteTask = async (projectId, taskId) => {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No autenticado' };
    }

    const response = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al eliminar la tarea'
      };
    }

    return {
      success: true,
      mensaje: 'Tarea eliminada exitosamente'
    };
  } catch (err) {
    console.error('Error en deleteTask:', err);
    return { success: false, error: err.message };
  }
};
