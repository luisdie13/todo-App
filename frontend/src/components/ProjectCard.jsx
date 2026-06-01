import React from 'react';
import {
  canEditProject,
  isAdmin,
  getProjectActions
} from '../utils/permissions';

/**
 * Componente ProjectCard
 * Muestra un proyecto con botones de acción basados en permisos ABAC
 * 
 * Props:
 * - proyecto: Objeto de proyecto
 * - usuario: Usuario actual
 * - membership: Membresía del usuario en el proyecto
 * - onEdit: Callback para editar
 * - onDelete: Callback para eliminar
 * - onArchive: Callback para archivar
 * - onUnarchive: Callback para desarchivar
 */
const ProjectCard = ({
  proyecto,
  usuario,
  membership,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive
}) => {
  // Obtener permisos para este proyecto
  const actions = getProjectActions(usuario, proyecto, membership);

  return (
    <div className={`project-card ${proyecto.estado === 'archivado' ? 'archived' : ''}`}>
      <div className="project-header">
        <h2 className="project-title">{proyecto.name}</h2>
        {proyecto.estado === 'archivado' && (
          <span className="badge badge-secondary">Archivado</span>
        )}
        {proyecto.estado === 'inactivo' && (
          <span className="badge badge-warning">Inactivo</span>
        )}
        {proyecto.estado === 'activo' && (
          <span className="badge badge-success">Activo</span>
        )}
      </div>

      {proyecto.description && (
        <p className="project-description">{proyecto.description}</p>
      )}

      <div className="project-meta">
        <small>Creado por: {proyecto.creador?.email || 'Usuario desconocido'}</small>
        <small>{new Date(proyecto.createdAt).toLocaleDateString()}</small>
        {membership && (
          <small>Tu rol: {membership.role === 'project_admin' ? 'Administrador' : membership.role === 'developer' ? 'Desarrollador' : 'Visualizador'}</small>
        )}
      </div>

      {proyecto.estado === 'archivado' && (
        <div className="alert alert-info">
          ℹ️ Este proyecto está archivado y es de solo lectura. No se pueden realizar cambios.
        </div>
      )}

      <div className="project-actions">
        {/* Botón para entrar al proyecto */}
        <a href={`/projects/${proyecto._id}`} className="btn btn-primary">
          📂 Ver Proyecto
        </a>

        {/* Botón para editar proyecto */}
        {actions.edit && proyecto.estado !== 'archivado' && (
          <button
            className="btn btn-warning btn-sm"
            onClick={() => onEdit(proyecto._id)}
            title="Editar proyecto"
          >
            ✏️ Editar
          </button>
        )}

        {/* Botón para archivar proyecto */}
        {actions.isAdmin && proyecto.estado !== 'archivado' && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (window.confirm('¿Deseas archivar este proyecto? Se volverá de solo lectura.')) {
                onArchive(proyecto._id);
              }
            }}
            title="Archivar proyecto"
          >
            📦 Archivar
          </button>
        )}

        {/* Botón para desarchivar proyecto */}
        {(actions.isAdmin || usuario?.rol === 'super_admin') && proyecto.estado === 'archivado' && (
          <button
            className="btn btn-info btn-sm"
            onClick={() => {
              if (window.confirm('¿Deseas desarchivar este proyecto?')) {
                onUnarchive(proyecto._id);
              }
            }}
            title="Desarchivar proyecto"
          >
            📂 Desarchivar
          </button>
        )}

        {/* Botón para eliminar proyecto (solo creador o super_admin) */}
        {(proyecto.creador?._id === usuario?.id || usuario?.rol === 'super_admin') && (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.')) {
                onDelete(proyecto._id);
              }
            }}
            title="Eliminar proyecto"
          >
            🗑️ Eliminar
          </button>
        )}

        {/* Mensaje para viewers */}
        {actions.isViewer && (
          <div className="alert alert-info">
            ℹ️ Tienes acceso de lectura. No puedes editar este proyecto.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectCard;
