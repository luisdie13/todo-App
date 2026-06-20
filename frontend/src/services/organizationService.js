import api from '../config/axios.config';

/**
 * Servicio de Organizaciones del frontend
 */

export const getMyOrganizations = async () => {
  try {
    const response = await api.get('/organizations');
    return {
      success: true,
      created: response.data.created || [],
      memberOf: response.data.memberOf || []
    };
  } catch (error) {
    console.error('Error al obtener organizaciones:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Error al obtener organizaciones',
      created: [],
      memberOf: []
    };
  }
};

export const createOrganization = async (name, description = '') => {
  try {
    const response = await api.post('/organizations', {
      name,
      description
    });
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.mensaje
    };
  } catch (error) {
    console.error('Error al crear organización:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Error al crear organización'
    };
  }
};

export const getOrganization = async (id) => {
  try {
    const response = await api.get(`/organizations/${id}`);
    return {
      success: true,
      organization: response.data
    };
  } catch (error) {
    console.error('Error al obtener organización:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Error al obtener organización'
    };
  }
};

export const updateOrganization = async (id, { name, description, estado }) => {
  try {
    const response = await api.put(`/organizations/${id}`, {
      name,
      description,
      estado
    });
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.mensaje
    };
  } catch (error) {
    console.error('Error al actualizar organización:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Error al actualizar organización'
    };
  }
};

export const deleteOrganization = async (id) => {
  try {
    const response = await api.delete(`/organizations/${id}`);
    return {
      success: true,
      message: response.data.mensaje
    };
  } catch (error) {
    console.error('Error al eliminar organización:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Error al eliminar organización'
    };
  }
};

export const inviteMember = async (organizationId, email, role = 'member') => {
  try {
    const response = await api.post(`/organizations/${organizationId}/invite`, {
      email,
      role
    });
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.mensaje
    };
  } catch (error) {
    console.error('Error al invitar miembro:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Error al invitar miembro'
    };
  }
};

export const removeMember = async (organizationId, memberId) => {
  try {
    const response = await api.delete(`/organizations/${organizationId}/members/${memberId}`);
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.mensaje
    };
  } catch (error) {
    console.error('Error al remover miembro:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Error al remover miembro'
    };
  }
};
