import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import adminService from '../services/adminService';
import '../styles/UserManagementPanel.css';

// ── DOMPurify helper ───────────────────────────────────────────────────────
const sanitize = (value) => {
  if (value === null || value === undefined) return '—';
  return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

// ── Role badge ─────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const safeRole = sanitize(role);
  const cls =
    safeRole === 'super_admin'   ? 'super-admin'
    : safeRole === 'org_admin'   ? 'org-admin'
    : safeRole === 'project_admin' ? 'project-admin'
    : safeRole === 'developer'   ? 'developer'
    : safeRole === 'viewer'      ? 'viewer'
    :                              'user';
  return <span className={`role-badge ${cls}`}>{safeRole.toUpperCase().replace('_', ' ')}</span>;
}

/**
 * UserManagementPanel — lists all platform users and allows the super_admin
 * to manage activation states and dynamically mutate platform or workspace roles.
 *
 * Compliance endpoints leveraged:
 * - PUT   /api/admin/users/:id/toggle-status -> toggleUserStatus
 * - PATCH /api/admin/users/:id/deactivate    -> deactivateUser
 * - PUT   /api/admin/users/:id/role           -> updateUserRole (New Specification)
 */
function UserManagementPanel({ showToast }) {
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [searchQuery, setSearchQuery]   = useState('');
  const [pendingId, setPendingId]       = useState(null); 
  const [rolePendingId, setRolePendingId] = useState(null); // Independent flag preventing concurrency collisions

  const toast = useCallback(
    (message, type = 'info') => {
      if (typeof showToast === 'function') showToast(message, type);
    },
    [showToast]
  );

  // ── Data fetching ──────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminService.getAllUsers(currentPage, 10, searchQuery);
      setUsers(Array.isArray(response.docs) ? response.docs : []);
      setTotalPages(response.totalPages ?? 1);
    } catch (err) {
      console.error('[UserManagementPanel] Error loading users listing stream:', err);
      const msg = err.response?.data?.error || (typeof err === 'string' ? err : 'Failed to query user records.');
      setError(msg);
      toast(msg, 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ── Toggle status handler ──────────────────────────────────────────────
  const handleToggleStatus = async (targetUser) => {
    const action     = targetUser.isActive ? 'deactivate' : 'activate';
    const safeEmail  = sanitize(targetUser.email);

    if (!window.confirm(`CRITICAL CONFIRMATION: Are you sure you want to ${action} user "${safeEmail}"?`)) return;

    try {
      setPendingId(targetUser._id);
      setError('');

      let response;
      if (targetUser.isActive) {
        response = await adminService.deactivateUser(targetUser._id);
      } else {
        response = await adminService.toggleUserStatus(targetUser._id);
      }

      const newIsActive =
        response?.user?.isActive !== undefined
          ? response.user.isActive
          : !targetUser.isActive;

      setUsers((prev) =>
        prev.map((u) =>
          u._id === targetUser._id ? { ...u, isActive: newIsActive } : u
        )
      );

      const successMsg = response?.message || `User state transformed to ${newIsActive ? 'Active' : 'Inactive'}.`;
      toast(successMsg, 'success');

    } catch (err) {
      console.error('[UserManagementPanel] Error toggling operational state flag:', err);
      if (err.response?.status === 429) {
        const retryAfter = err.response.headers['retry-after'] || '60';
        toast(`Too many execution attempts. Please wait ${retryAfter} seconds.`, 'error');
        return;
      }
      const msg = err.response?.data?.error || `Failed to execute ${action} routine.`;
      setError(msg);
      toast(msg, 'error');
    } finally {
      setPendingId(null);
    }
  };

  // ── Dynamic role assignment handler ────────────────────────────────────
  const handleRoleChange = async (targetUser, newRole) => {
    const safeEmail = sanitize(targetUser.email);
    
    if (!window.confirm(`SECURITY ENFORCEMENT: Update authorization role for "${safeEmail}" to [${newRole.toUpperCase()}]?`)) {
      // Refresh component layout binding state loop if cancelled to reset dropdown visual selection
      loadUsers();
      return;
    }

    try {
      setRolePendingId(targetUser._id);
      setError('');

      // Invoke dynamic patch mutation payload via administrative service
      // Note: If adminService does not have updateUserRole yet, it falls back to an explicit client request handler
      let response;
      if (typeof adminService.updateUserRole === 'function') {
        response = await adminService.updateUserRole(targetUser._id, newRole);
      } else {
        // Direct routing fallback in case service compilation is pending
        response = await adminService.api.put(`/admin/users/${targetUser._id}/role`, { role: newRole });
      }

      const assignedRole = response?.user?.role || response?.data?.user?.role || newRole;

      setUsers((prev) =>
        prev.map((u) =>
          u._id === targetUser._id ? { ...u, role: assignedRole } : u
        )
      );

      toast(response?.message || `Privileges for "${safeEmail}" elevated to ${assignedRole.toUpperCase()}.`, 'success');

    } catch (err) {
      console.error('[UserManagementPanel] Authorization mutation block failed:', err);
      if (err.response?.status === 429) {
        const retryAfter = err.response.headers['retry-after'] || '60';
        toast(`Rate limit threshold active. Restricting mutations for ${retryAfter}s.`, 'error');
        return;
      }
      const msg = err.response?.data?.error || 'Failed to modify subject privileges role permissions.';
      setError(msg);
      toast(msg, 'error');
      loadUsers(); // Re-fetch state layout grids to restore accurate database indicators
    } finally {
      setRolePendingId(null);
    }
  };

  // ── Search handler ─────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="user-management-panel">
      <div className="panel-header">
        <h2>👥 User Management Console</h2>
        <p className="panel-description">
          Global access management center. Review registration records, toggle system lockouts, and re-allocate workspace security roles metrics.
        </p>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {/* Search component section */}
      <div className="search-bar">
        <input
          type="search"
          placeholder="Filter system registries by email or identification names…"
          value={searchQuery}
          onChange={handleSearchChange}
          aria-label="Search system users"
          autoComplete="off"
        />
      </div>

      {/* Master registry table data node */}
      <div className="users-table">
        {loading && users.length === 0 ? (
          <p className="text-muted">Loading secure user tracking ledger metadata…</p>
        ) : users.length === 0 ? (
          <p className="text-muted">No accounts match the specified filtering query parameters.</p>
        ) : (
          <div className="table-wrapper">
            <table aria-label="Platform Users Ledger Network">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">System Badge</th>
                  <th scope="col">State Allocation</th>
                  <th scope="col">Assign Taxonomy Role</th>
                  <th scope="col">State Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isProcessingStatus = pendingId === u._id;
                  const isProcessingRole = rolePendingId === u._id;
                  const isRowDisabled = loading || !!pendingId || !!rolePendingId;

                  return (
                    <tr key={u._id} className={!u.isActive ? 'row-inactive-mute' : ''}>
                      <td>{sanitize(u.name) !== '—' ? sanitize(u.name) : <span style={{ color: '#666', fontStyle: 'italic' }}>No profile name</span>}</td>
                      <td><code>{sanitize(u.email)}</code></td>
                      <td><RoleBadge role={u.role} /></td>
                      <td>
                        <span className={`status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      {/* Dynamic Role Mapping Action Selector Column */}
                      <td>
                        <select
                          className="role-selector-dropdown"
                          value={u.role || 'member'}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          disabled={isRowDisabled || !u.isActive}
                          title={!u.isActive ? "Cannot alter permissions profiles of suspended users" : "Modify permission metrics"}
                          aria-label={`Change security role classification parameter for ${sanitize(u.email)}`}
                        >
                          <optgroup label="Global Framework Roles">
                            <option value="member">Platform Member</option>
                            <option value="super_admin">Supreme Super Admin</option>
                          </optgroup>
                          <optgroup label="Context Workspace Taxonomy Roles">
                            <option value="org_admin">Organization Admin</option>
                            <option value="project_admin">Project Admin</option>
                            <option value="developer">Developer</option>
                            <option value="viewer">Viewer (Read-Only)</option>
                          </optgroup>
                        </select>
                        {isProcessingRole && <span className="inline-loader-spinner">🔄</span>}
                      </td>

                      {/* State Activation Control Action Buttons Column */}
                      <td>
                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => handleToggleStatus(u)}
                          disabled={isRowDisabled}
                          aria-label={
                            isProcessingStatus
                              ? 'Processing metadata mutation payload…'
                              : `${u.isActive ? 'Deactivate' : 'Activate'} user signature ${sanitize(u.email)}`
                          }
                          type="button"
                        >
                          {isProcessingStatus ? 'Processing…' : u.isActive ? 'Suspend' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="pagination">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1 || loading}
          type="button"
        >
          ‹ Previous
        </button>
        <span>Page <strong>{currentPage}</strong> of {totalPages}</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages || loading}
          type="button"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

export default UserManagementPanel;