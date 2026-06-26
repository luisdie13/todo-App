import api from '../config/axios.config';

/**
 * adminService — API client layout for administrative super_admin endpoints.
 *
 * Requirements Met:
 * - Propagates rich Axios exception signatures to allow downstream rate-limit countdown hooks.
 * - Leverages centralized token authorization mapping from volatile memory wrappers.
 * - Operates entirely within the volatile memory lifecycle (localStorage isolation).
 *
 * Endpoint Matrix Mapping:
 * - GET    /api/admin/users                     → getAllUsers(page, limit, search)
 * - PUT    /api/admin/users/:userId/toggle-status → toggleUserStatus(userId)
 * - PATCH  /api/admin/users/:userId/deactivate   → deactivateUser(userId)
 * - GET    /api/admin/audit-logs                → getGlobalAuditLogs(filters)
 * - GET    /api/admin/audit-stats               → getAuditStats()
 */
const adminService = {

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/admin/users
  // Retrieves a paginated, filterable listing of system users registries.
  // ═══════════════════════════════════════════════════════════════════════════
  getAllUsers: async (page = 1, limit = 10, search = '') => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append('search', search.trim());
      
      const response = await api.get(`/admin/users?${params.toString()}`);
      return response.data;
    } catch (error) {
      // Propagates the rich exception instance to retain network context status codes (e.g., 429)
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PUT /api/admin/users/:userId/toggle-status
  // Toggles account status parameters (Active ↔ Inactive) inside MongoDB.
  // Used for administrative re-activation tasks.
  // ═══════════════════════════════════════════════════════════════════════════
  toggleUserStatus: async (userId) => {
    try {
      const response = await api.put(`/admin/users/${userId}/toggle-status`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /api/admin/users/:userId/deactivate
  // Explicit account suspension command (forces isActive flag to false).
  // Returns HTTP 409 conflict if target registry matches required flag.
  // ═══════════════════════════════════════════════════════════════════════════
  deactivateUser: async (userId) => {
    try {
      const response = await api.patch(`/admin/users/${userId}/deactivate`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/admin/audit-logs
  // Queries the centralized immutable infrastructure logging collection records.
  // Filters supported: event, email, ip, page, limit
  // ═══════════════════════════════════════════════════════════════════════════
  getGlobalAuditLogs: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== '' && val !== undefined && val !== null) {
          params.append(key, String(val).trim());
        }
      });
      
      const response = await api.get(`/admin/audit-logs?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/admin/audit-stats
  // Computes real-time analytical aggregate telemetry metrics from data ledger collections.
  // ═══════════════════════════════════════════════════════════════════════════
  getAuditStats: async () => {
    try {
      const response = await api.get('/admin/audit-stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default adminService;