import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../config/axios.config'; 
import { AuthContext } from '../context/AuthContext';
import '../styles/Project.css';

/**
 * Organization Component — Contextual workplace area for SecureCollab.
 * Enforces rigid client-side injection mitigations and schema field alignment.
 * Includes explicit membership administration tables for operational role mutation.
 */
function Organization({ user, onLogout }) {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext);

  const [organization, setOrganization]           = useState(null);
  const [projects, setProjects]                     = useState([]);
  const [loading, setLoading]                       = useState(true);
  const [loadingOrg, setLoadingOrg]                 = useState(true);
  const [error, setError]                           = useState('');
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName]         = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject]       = useState(false);
  const [userRole, setUserRole]                     = useState(null); 
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete]       = useState(null);
  const [deletingProject, setDeletingProject]       = useState(false);

  // ── Membership Administration States ───────────────────────────────────────
  const [inviteEmail, setInviteEmail]               = useState('');
  const [inviteRole, setInviteRole]                 = useState('developer');
  const [invitingMember, setInvitingMember]         = useState(false);
  const [mutatingMemberId, setMutatingMemberId]     = useState(null);

  // ── DOMPurify Strict Plain Text Sanitizer (OWASP Mitigation) ──────────────
  const sanitize = useCallback((value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  }, []);

  const loadOrganizationData = async () => {
    try {
      setLoading(true);
      setLoadingOrg(true);
      setError('');

      // Fetch precise details using the active profile allocation mapping
      const response = await api.get('/organizations');
      const allOrgs = [...(response.data.created || []), ...(response.data.memberOf || [])];
      const org = allOrgs.find(o => o._id === organizationId);
      
      if (!org) {
        setError('Organization registry data not found.');
        setLoadingOrg(false);
        return;
      }

      setOrganization(org);

      const currentUserId = user?._id || user?.id;
      const isOwner = org?.ownerId === currentUserId || org?.ownerId?._id === currentUserId;
      const isOrgAdmin = org?.members?.some(member => {
        const memberId = member.userId?._id || member.userId;
        return String(memberId) === String(currentUserId) && (member.role === 'org_admin' || member.role === 'admin');
      });
      
      const hasAdminPrivileges = isOwner || isOrgAdmin || user?.role === 'super_admin';
      setUserRole(hasAdminPrivileges ? 'org_admin' : 'member');

      try {
        const projRes = await api.get(`/organizations/${organizationId}/projects`);
        const projectsList = projRes.data.projects || projRes.data.proyectos || [];
        setProjects(Array.isArray(projectsList) ? projectsList : []);
      } catch (err) {
        console.error('[Organization] Failed to load associated project listing metrics:', err);
        setProjects([]);
      }
    } catch (err) {
      setError('Failed to retrieve secure organization records.');
      setProjects([]);
    } finally {
      setLoading(false);
      setLoadingOrg(false);
    }
  };

  // ── Synchronize workspace parameters with memory authentication lifecycle ──
  useEffect(() => {
    if (authLoading || !user) return;
    loadOrganizationData();
  }, [organizationId, user, authLoading]);

  // ── Contextual ABAC Authorization Gate Check (Rule 1 Enforcement) ─────────
  useEffect(() => {
    if (loading || loadingOrg || !user || !organization || !organization.members) return;

    const currentUserId = user._id || user.id;
    const isSuperAdmin = user?.role === 'super_admin';

    const isMemberOrAdmin = organization.members.some(m => {
      const memberUserId = m.userId?._id || m.userId;
      return String(memberUserId) === String(currentUserId);
    });

    if (!isMemberOrAdmin && !isSuperAdmin) {
      console.warn("❌ Access Denied: User does not belong to this organization boundary.");
      navigate('/dashboard', { replace: true });
    }
  }, [loading, loadingOrg, user, organization, navigate]);

  const handleCreateProject = async () => {
    const cleanName = sanitize(newProjectName);
    const cleanDesc = sanitize(newProjectDescription);

    if (!cleanName) {
      alert('Project specification name is required.');
      return;
    }

    try {
      setCreatingProject(true);
      const response = await api.post(`/organizations/${organizationId}/projects`, {
        name: cleanName,
        description: cleanDesc
      });
      
      const newProject = response.data.project || response.data;
      setProjects([...projects, newProject]);
      
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateProjectModal(false);
    } catch (err) {
      console.error('[Organization] Project creation error:', err);
      if (err.response?.status === 429) {
        alert(`Rate limit exceeded. Retry-After: ${err.response.headers['retry-after'] || '60'} seconds.`);
        return;
      }
      alert('Authorization Rejected: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreatingProject(false);
    }
  };

  // ── Membership Mutation Routines (Contextual RBAC Control) ─────────────────
  const handleInviteMember = async (e) => {
    e.preventDefault();
    const cleanEmail = sanitize(inviteEmail).toLowerCase();
    if (!cleanEmail) return;

    try {
      setInvitingMember(true);
      const response = await api.post(`/organizations/${organizationId}/invite`, {
        email: cleanEmail,
        role: inviteRole
      });

      const updatedOrg = response.data.organization || organization;
      setOrganization(updatedOrg);
      setInviteEmail('');
      alert('Collaborator successfully assigned to organization registry.');
    } catch (err) {
      console.error('[Organization] Invitation error:', err);
      alert('Action Denied: ' + (err.response?.data?.error || err.message));
    } finally {
      setInvitingMember(false);
    }
  };

  const handleMutationRole = async (memberUserId, newContextRole) => {
    if (!window.confirm(`SECURITY ENFORCEMENT: Alter member access taxonomy to [${newContextRole.toUpperCase()}]?`)) return;

    try {
      setMutatingMemberId(memberUserId);
      // Calls updated network routes synchronizing memberships parameters matrix
      const response = await api.put(`/organizations/${organizationId}/members/${memberUserId}/role`, {
        role: newContextRole
      });

      const updatedOrg = response.data.organization || response.data;
      if (updatedOrg && updatedOrg.members) {
        setOrganization(updatedOrg);
      } else {
        await loadOrganizationData();
      }
    } catch (err) {
      console.error('[Organization] Member role patch mutation failure:', err);
      alert('Mutation Blocked: ' + (err.response?.data?.error || err.message));
    } finally {
      setMutatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!window.confirm('Are you sure you want to evict this member from the workspace environment?')) return;

    try {
      setMutatingMemberId(memberUserId);
      const response = await api.delete(`/organizations/${organizationId}/members/${memberUserId}`);
      
      const updatedOrg = response.data.organization || response.data;
      if (updatedOrg && updatedOrg.members) {
        setOrganization(updatedOrg);
      } else {
        await loadOrganizationData();
      }
    } catch (err) {
      console.error('[Organization] Member eviction failed:', err);
      alert('Revocation Denied: ' + (err.response?.data?.error || err.message));
    } finally {
      setMutatingMemberId(null);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!window.confirm('CRITICAL WARN: Are you absolutely sure you want to permanently delete this organization? This destructive process cannot be rolled back.')) return;

    try {
      await api.delete(`/organizations/${organizationId}`);
      navigate('/dashboard');
    } catch (err) {
      console.error('[Organization] Purge operation failure:', err);
      alert('Operation Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteProject = (projectId) => {
    setProjectToDelete(projectId);
    setShowDeleteProjectModal(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      setDeletingProject(true);
      await api.delete(`/projects/${projectToDelete}`);
      setProjects(projects.filter(p => p._id !== projectToDelete));
      setShowDeleteProjectModal(false);
      setProjectToDelete(null);
    } catch (err) {
      console.error('[Organization] Project data destruction failed:', err);
      alert('Action Denied: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingProject(false);
    }
  };

  const cancelDeleteProject = () => {
    setShowDeleteProjectModal(false);
    setProjectToDelete(null);
  };

  const isOrgAdmin = userRole === 'org_admin';

  if (loading || loadingOrg || !user || !organization) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#ffffff' }}>
        <p>⏳ Loading workplace organization context records…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#ff5252' }}>{sanitize(error)}</p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: '15px' }}>
          Return to Secure Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="project-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="project-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div>
          <h1 style={{ color: '#ffffff' }}>📁 {sanitize(organization.name)}</h1>
          <p style={{ color: '#b0b3b8' }}>{sanitize(organization.description) || 'No structural description assigned'}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Go Back
        </button>
      </div>

      <div className="organization-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '30px' }}>
        
        {/* Left Column: Assigned Project Pipelines */}
        <div className="tasks-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#ffffff' }}>Assigned Projects ({projects.length})</h2>
            {isOrgAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateProjectModal(true)}>
                ➕ New Project
              </button>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="no-tasks">
              <p>No active projects found within this workspace perimeter.</p>
              {isOrgAdmin && <p style={{ marginTop: '10px' }}>Deploy a project pipeline target using the button above.</p>}
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map((project) => {
                const projectStatus = sanitize(project.status || 'active');
                return (
                  <div key={project._id} className={`project-card p-status-${projectStatus}`} style={{ position: 'relative' }}>
                    <div onClick={() => navigate(`/project/${project._id}`)}>
                      <h3>{sanitize(project.name)}</h3>
                      <p>{sanitize(project.description) || 'No specifications provided.'}</p>
                      <div className="project-status">
                        <span className={`badge status-${projectStatus}`}>
                          {projectStatus.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {isOrgAdmin && (
                      <button
                        className="btn-delete-project"
                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(project._id); }}
                        title="Purge project registry records"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Organization Membership Board */}
        <div className="membership-sidebar" style={{ background: '#14161d', padding: '20px', borderRadius: '8px', border: '1px solid #2f313a' }}>
          <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>👥 Workspace Members</h3>
          
          {/* Invite Member Section Form */}
          {isOrgAdmin && (
            <form onSubmit={handleInviteMember} style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input 
                type="email"
                placeholder="User account email context…"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{ background: '#1f222b', color: '#fff', border: '1px solid #2f313a', padding: '8px', borderRadius: '4px' }}
                required
              />
              <select 
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                style={{ background: '#1f222b', color: '#fff', border: '1px solid #2f313a', padding: '8px', borderRadius: '4px' }}
              >
                <option value="developer">Developer</option>
                <option value="viewer">Viewer (Read-Only)</option>
                <option value="org_admin">Organization Admin</option>
              </select>
              <button type="submit" className="btn btn-primary btn-sm" disabled={invitingMember}>
                {invitingMember ? 'Adding…' : '➕ Allocate Member'}
              </button>
            </form>
          )}

          {/* Members Mapping Context Table */}
          <div className="members-list-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {organization.members?.map((member, idx) => {
              const mUserId = member.userId?._id || member.userId;
              const cleanEmail = sanitize(member.userId?.email || 'Pending identification…');
              const cleanName = sanitize(member.userId?.name || 'Collaborator Asset');
              const isTargetProcessing = mutatingMemberId === mUserId;
              const isOwnerRow = organization.ownerId === mUserId || organization.ownerId?._id === mUserId;

              return (
                <div key={mUserId || `member-idx-${idx}`} style={{ padding: '10px', background: '#1f222b', borderRadius: '6px', border: '1px solid #2f313a' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '8px' }}>
                    <strong style={{ color: '#fff', fontSize: '14px' }}>{cleanName}</strong>
                    <code style={{ color: '#888', fontSize: '12px' }}>{cleanEmail}</code>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {isOrgAdmin && !isOwnerRow ? (
                      <select
                        value={member.role || 'developer'}
                        onChange={(e) => handleMutationRole(mUserId, e.target.value)}
                        disabled={isTargetProcessing}
                        style={{ background: '#14161d', color: '#fff', border: '1px solid #2f313a', fontSize: '12px', padding: '4px' }}
                      >
                        <option value="org_admin">Org Admin</option>
                        <option value="project_admin">Project Admin</option>
                        <option value="developer">Developer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`badge status-${member.role === 'org_admin' ? 'active' : 'archived'}`} style={{ fontSize: '11px' }}>
                        {isOwnerRow ? 'FOUNDER ROOT' : (member.role || 'MEMBER').toUpperCase()}
                      </span>
                    )}

                    {isOrgAdmin && !isOwnerRow && (
                      <button 
                        onClick={() => handleRemoveMember(mUserId)}
                        disabled={isTargetProcessing}
                        style={{ background: 'none', border: 'none', color: '#ff5252', cursor: 'pointer', fontSize: '13px' }}
                        title="Revoke space credentials"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isOrgAdmin && (
            <button 
              className="btn btn-danger btn-sm" 
              onClick={handleDeleteOrganization}
              style={{ width: '100%', marginTop: '30px' }}
            >
              🗑️ Delete Organization Perimeter
            </button>
          )}
        </div>

      </div>

      <style>{`
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .project-card {
          background: #1a1c23;
          border: 1px solid #2f313a;
          border-radius: 8px;
          padding: 20px;
          transition: all 0.3s ease;
        }
        .project-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transform: translateY(-2px);
        }
        .project-card h3 {
          margin: 0 0 10px 0;
          color: #ffffff;
        }
        .project-card p {
          color: #999999;
          font-size: 14px;
          margin: 0 0 15px 0;
        }
        .project-status {
          display: flex;
          gap: 10px;
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge.status-active {
          background: rgba(46, 125, 50, 0.15);
          color: #2e7d32;
          border: 1px solid #2e7d32;
        }
        .badge.status-archived {
          background: rgba(198, 40, 40, 0.15);
          color: #c62828;
          border: 1px solid #c62828;
        }
        .btn-delete-project {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(211, 47, 47, 0.1);
          border: 1px solid #ef5350;
          color: #ef5350;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .no-tasks {
          text-align: center;
          padding: 40px;
          background: #14161d;
          border-radius: 8px;
          color: #666;
          border: 1px dashed #2f313a;
        }
      `}</style>

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Deploy New Project Context</h2>
              <button className="modal-close" onClick={() => setShowCreateProjectModal(false)}>✕</button>
            </div>
            <div className="task-form">
              <div className="form-group">
                <label htmlFor="project-name">Project Designation *</label>
                <input
                  id="project-name"
                  type="text"
                  placeholder="e.g.: Core API Integration"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label htmlFor="project-description">Scope Specifications</label>
                <textarea
                  id="project-description"
                  placeholder="Briefly describe the engineering parameters…"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateProjectModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateProject} disabled={creatingProject}>
                {creatingProject ? 'Processing…' : 'Save Project Specification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {showDeleteProjectModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>⚠️ Confirm Destructive Purge</h2>
            </div>
            <div style={{ padding: '20px', color: '#ffffff' }}>
              <p>Are you sure you want to permanently delete this project entity from MongoDB?</p>
              <p style={{ color: '#ef5350', fontSize: '13px', marginTop: '10px' }}>This resource cannot be recovered.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelDeleteProject} disabled={deletingProject}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDeleteProject} disabled={deletingProject}>
                {deletingProject ? 'Purging…' : '🗑️ Delete Resource'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Organization;