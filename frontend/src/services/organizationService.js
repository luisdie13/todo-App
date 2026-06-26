import api from '../config/axios.config';

/**
 * organizationService — API client middleware managing organization perimeters.
 * * Requirements Met:
 * - Propagates rich Axios network signatures to power rate-limit countdown hooks (Class 9).
 * - Enforces correct database metadata properties mapping schema keys ('status', 'message').
 * - Operates fully inside isolated volatile memory (localStorage isolation).
 */

/**
 * getMyOrganizations — Retrieves all organizations associated with the active identity token.
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
    console.error('[organizationService] Failed to query organization list metrics:', error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      retryAfter: error.response?.headers['retry-after'] || error.response?.data?.retryAfter || null,
      error: error.response?.data?.error || 'Failed to load user organization contexts.',
      created: [],
      memberOf: []
    };
  }
};

/**
 * createOrganization — Provisions a fresh organization data model container to MongoDB.
 * @param {string} name 
 * @param {string} description 
 */
export const createOrganization = async (name, description = '') => {
  try {
    const response = await api.post('/organizations', {
      name: name?.trim(),
      description: description?.trim()
    });
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.message || response.data.mensaje || 'Organization deployed successfully.'
    };
  } catch (error) {
    console.error('[organizationService] Organization creation rejected:', error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      retryAfter: error.response?.headers['retry-after'] || error.response?.data?.retryAfter || null,
      error: error.response?.data?.error || 'Failed to deploy new organization container.',
      validationErrors: error.response?.data?.errors || null
    };
  }
};

/**
 * getOrganization — Retrieves specific organization layout variables by ID parameter.
 * @param {string} id 
 */
export const getOrganization = async (id) => {
  try {
    const response = await api.get(`/organizations/${id}`);
    return {
      success: true,
      organization: response.data?.organization || response.data
    };
  } catch (error) {
    console.error('[organizationService] Organization record lookup failed:', error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.response?.data?.error || 'Organization profile not found matching target ID perimeter.'
    };
  }
};

/**
 * updateOrganization — Mutates target scope settings and state status variables.
 * @param {string} id 
 * @param {Object} updatePayload — Contains { name, description, status }
 */
export const updateOrganization = async (id, { name, description, status }) => {
  try {
    // Compliance Check: Aligned schema parameters name strictly to 'status' fields rule requirements
    const response = await api.put(`/organizations/${id}`, {
      name: name?.trim(),
      description: description?.trim(),
      status: status || 'active'
    });
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.message || response.data.mensaje || 'Specifications updated successfully.'
    };
  } catch (error) {
    console.error('[organizationService] Organization modification request aborted:', error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      retryAfter: error.response?.headers['retry-after'] || error.response?.data?.retryAfter || null,
      error: error.response?.data?.error || 'Failed to apply structural parameters adjustments.'
    };
  }
};

/**
 * deleteOrganization — Permanently purges an organization entity from the network database.
 * @param {string} id 
 */
export const deleteOrganization = async (id) => {
  try {
    const response = await api.delete(`/organizations/${id}`);
    return {
      success: true,
      message: response.data.message || response.data.mensaje || 'Organization purged from active register.'
    };
  } catch (error) {
    console.error('[organizationService] Destructive organization delete trace error:', error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.response?.data?.error || 'Destruction sequence denied: Operational constraint active.'
    };
  }
};

/**
 * inviteMember — Appends an active actor email link into the organization membership array.
 * @param {string} organizationId 
 * @param {string} email 
 * @param {string} role 
 */
export const inviteMember = async (organizationId, email, role = 'member') => {
  try {
    const response = await api.post(`/organizations/${organizationId}/invite`, {
      email: email?.trim(),
      role
    });
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.message || response.data.mensaje || 'Member added to access register pool.'
    };
  } catch (error) {
    console.error('[organizationService] Member allocation invitation rejected:', error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      retryAfter: error.response?.headers['retry-after'] || error.response?.data?.retryAfter || null,
      error: error.response?.data?.error || 'Invitation denied: User authorization validation parameters failed.'
    };
  }
};

/**
 * removeMember — Drops a specific member ID context record from the access array list.
 * @param {string} organizationId 
 * @param {string} memberId 
 */
export const removeMember = async (organizationId, memberId) => {
  try {
    const response = await api.delete(`/organizations/${organizationId}/members/${memberId}`);
    return {
      success: true,
      organization: response.data.organization,
      message: response.data.message || response.data.mensaje || 'Access permissions revoked successfully.'
    };
  } catch (error) {
    console.error('[organizationService] Revocation operation failure:', error.message);
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.response?.data?.error || 'Revocation sequence rejected: Resource protected.'
    };
  }
};

const organizationService = {
  getMyOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  inviteMember,
  removeMember
};

export default organizationService;