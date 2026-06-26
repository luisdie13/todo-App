import React from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { getProjectActions } from '../utils/permissions';

/**
 * ProjectCard Component
 * Renders an organization project unit applying strict contextual ABAC parameters
 * and sanitization filters to mitigate XSS vulnerabilities.
 *
 * Props:
 * - project: Project metadata schema object from database registry
 * - user: Authenticated global system user entity from memory store
 * - membership: User context role assigned within this project scope
 * - onEdit: Callback function to trigger project name/description updates
 * - onDelete: Destructive callback to purge project dataset records
 * - onArchive: Callback function to lock project transitions to 'archived'
 * - onUnarchive: Callback function to restore project status to 'active'
 */
const ProjectCard = ({
  project,
  user,
  membership,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive
}) => {
  // Resolve runtime ABAC permission layout matrix for this specific project context
  const actions = getProjectActions(user, project, membership);
  
  const isSuperAdmin = user?.role === 'super_admin';
  const isProjectArchived = project?.status === 'archived';

  // ── DOMPurify Strict Plain Text Helper ────────────────────────────────────
  const sanitize = (value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  };

  // Safe data properties sanitization
  const cleanName = sanitize(project.name);
  const cleanDescription = sanitize(project.description);
  const creatorEmail = sanitize(project.creator?.email || project.createdBy?.email || 'Workspace System');
  const contextRole = sanitize(membership?.role || 'viewer');

  return (
    <div className={`project-card ${isProjectArchived ? 'archived' : ''}`}>
      <div className="project-header">
        <h2 className="project-title">{cleanName}</h2>
        
        {/* Enforces strict alignment with database schema field configurations (active/archived) */}
        {isProjectArchived ? (
          <span className="badge status-archived">Archived</span>
        ) : (
          <span className="badge status-active">Active</span>
        )}
      </div>

      {cleanDescription && (
        <p className="project-description">{cleanDescription}</p>
      )}

      <div className="project-meta">
        <small>Created by: {creatorEmail}</small>
        <small>{new Date(project.createdAt).toLocaleDateString()}</small>
        {membership && (
          <small>
            Context Role: <strong>{contextRole.toUpperCase().replace('_', ' ')}</strong>
          </small>
        )}
      </div>

      {isProjectArchived && (
        <div className="alert alert-info-read-only" role="alert">
          ℹ️ <strong>Archived Perimeter:</strong> This project metadata is locked as read-only. Modifications are restricted.
        </div>
      )}

      <div className="project-actions">
        {/* Secure SPA Route Passage — Replaced native anchors to protect in-memory token states */}
        <Link to={`/project/${project._id}`} className="btn btn-primary">
          📂 View Project Tasks
        </Link>

        {/* Edit Action — Enforces contextual lock parameter verification */}
        {actions.edit && !isProjectArchived && (
          <button
            className="btn btn-warning btn-sm"
            onClick={() => onEdit(project._id)}
            title="Edit project designation metadata"
            type="button"
          >
            ✏️ Edit
          </button>
        )}

        {/* Archive Process — Subject to project_admin or org_admin constraints */}
        {(actions.isAdmin || isSuperAdmin) && !isProjectArchived && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (window.confirm('Are you sure you want to archive this project context? All underlying assets will transition to Read-Only mode.')) {
                onArchive(project._id);
              }
            }}
            title="Archive project boundary"
            type="button"
          >
            📦 Archive
          </button>
        )}

        {/* Unarchive Reversal — Granted exclusively to authorized admins */}
        {(actions.isAdmin || isSuperAdmin) && isProjectArchived && (
          <button
            className="btn btn-info btn-sm"
            onClick={() => {
              if (window.confirm('Do you want to restore and activate this project pipeline?')) {
                onUnarchive(project._id);
              }
            }}
            title="Restore project activity"
            type="button"
          >
            📂 Restore Active Status
          </button>
        )}

        {/* Destructive Deletion Action — Restricted according to strict creator rules */}
        {(project.creatorId === user?._id || project.creator?._id === user?._id || isSuperAdmin) && (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('CRITICAL WARN: Are you sure you want to permanently purge this project entity? This process cannot be undone.')) {
                onDelete(project._id);
              }
            }}
            title="Permanently purge project data"
            type="button"
          >
            🗑️ Delete
          </button>
        )}

        {/* View-Only Explicit Inline Warning Banner */}
        {contextRole === 'viewer' && (
          <div className="alert alert-info-view-notice" role="alert">
            ℹ️ View-Only Session: Your context role scope blocks write access parameters.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectCard;