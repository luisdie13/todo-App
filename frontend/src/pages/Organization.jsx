import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/authService';
import { AuthContext } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import '../styles/Project.css';

function Organization({ user, onLogout }) {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext); // ✅ NUEVO: Obtener authLoading del contexto
  const { canCreateProject } = usePermissions();
  const [organization, setOrganization] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrg, setLoadingOrg] = useState(true); // Estado de carga exclusivo para la organización
  const [error, setError] = useState('');
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'org_admin' o 'member'
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deletingProject, setDeletingProject] = useState(false);

  // ✅ CRÍTICO: El useEffect ahora depende de [organizationId, user, authLoading]
  // De esta forma, cuando el usuario vuelve a estar disponible tras un refresh (F5),
  // este efecto se ejecuta nuevamente y re-dispara la carga de datos
  useEffect(() => {
    // Si el estado global de autenticación todavía está cargando, o no hay usuario, espera.
    if (authLoading || !user) {
      console.log('⏳ [Organization] Esperando autenticación... authLoading:', authLoading, 'user:', !!user);
      return;
    }

    loadOrganizationData();
  }, [organizationId, user, authLoading]);

  // CRÍTICO: Validación de permisos ASÍNCRONA y SEGURA
  // Solo ejecutar cuando AMBOS (user + organization) estén completamente cargados
  // Esto previene redirecciones prematuras que expulsan al usuario en refresh
  useEffect(() => {
    // Si algo está cargando o falta información crítica, NO hacer validación de seguridad
    if (loading || loadingOrg || !user || !user._id || !organization || !organization.members) {
      console.log('⏳ Esperando datos completos antes de validar permisos...', { 
        loading,
        loadingOrg,
        userLoaded: !!(user && user._id), 
        orgLoaded: !!(organization && organization.members) 
      });
      return;
    }

    // Una vez que AMBOS existen completamente, hacer la verificación real
    const isMemberOrAdmin = organization.members?.some(m => {
      const memberUserId = m.userId?._id || m.userId;
      return memberUserId === user.id || memberUserId === user._id;
    });

    const isOrgAdmin = organization.members?.some(m => {
      const memberUserId = m.userId?._id || m.userId;
      return (memberUserId === user.id || memberUserId === user._id) && m.role === 'org_admin';
    });

    // Log detallado para debugging
    console.log('✅ Validación de permisos completada:', {
      isMemberOrAdmin,
      isOrgAdmin,
      userId: user._id || user.id,
      orgMembers: organization.members?.map(m => ({
        userId: m.userId?._id || m.userId,
        role: m.role
      }))
    });

    // Aplicar redirección de seguridad SÓLO si la verificación real falló con datos certeros
    if (!isMemberOrAdmin) {
      console.warn("❌ Acceso denegado: El usuario no pertenece a esta organización");
      navigate('/dashboard', { replace: true });
    }
  }, [loading, loadingOrg, user, organization, navigate]);

  // Función auxiliar para comparar IDs (maneja ObjectId vs string)
  const isSameId = (id1, id2) => {
    if (!id1 || !id2) return false;
    const str1 = id1.toString?.() || String(id1);
    const str2 = id2.toString?.() || String(id2);
    return str1 === str2;
  };

   const loadOrganizationData = async () => {
     try {
       setLoading(true);
       setLoadingOrg(true); // Iniciar carga exclusiva de la organización
       const response = await api.get('/organizations');
       const allOrgs = [...(response.data.created || []), ...(response.data.memberOf || [])];
       const org = allOrgs.find(o => o._id === organizationId);
       
       if (!org) {
         setError('Organización no encontrada');
         setLoadingOrg(false); // Marcar como cargada incluso en error
         return;
       }

       setOrganization(org);

        // Determinar el rol del usuario en esta organización
        const currentUserId = user?._id || user?.id;
        const isOwner = org?.orgOwnerId?._id === currentUserId;
        const isOrgAdmin = org?.members?.some(member => {
          const memberId = member.userId?._id || member.userId;
          return memberId === currentUserId && member.role === 'org_admin';
        });
        const canCreateProject = isOwner || isOrgAdmin;
        
        if (canCreateProject) {
          console.log('✅ Usuario es org_admin de la organización', org.name, { isOwner, isOrgAdmin, userId: currentUserId });
        } else {
          console.log('⚠️ Usuario NO es org_admin. Verificar:', { 
            orgOwnerId: org.orgOwnerId, 
            userId: currentUserId, 
            members: org.members?.map(m => ({ userId: m.userId?._id || m.userId, role: m.role }))
          });
        }
        
        setUserRole(canCreateProject ? 'org_admin' : 'member');

      // Obtener proyectos de esta organización
      // Hacer GET a un endpoint que retorne los proyectos de una org
      try {
        const projRes = await api.get(`/organizations/${organizationId}/projects`);
        // El backend devuelve { success, projects, total }
        const projectsList = projRes.data.projects || projRes.data.proyectos || [];
        setProjects(Array.isArray(projectsList) ? projectsList : []);
      } catch (err) {
        console.error('Error al cargar proyectos:', err);
        setProjects([]);
      }
    } catch (err) {
      setError('Error cargando organización');
      setProjects([]);
    } finally {
      setLoading(false);
      setLoadingOrg(false); // Finalizar carga exclusiva de la organización
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('El nombre del proyecto es requerido');
      return;
    }

    try {
      setCreatingProject(true);
      const response = await api.post(`/organizations/${organizationId}/projects`, {
        name: newProjectName,
        description: newProjectDescription
      });
      
      console.log('✅ Proyecto creado. Response:', response.data);
      
      // El backend retorna { mensaje, project }
      const newProject = response.data.project || response.data;
      
      // Agregar el nuevo proyecto a la lista
      setProjects([...projects, newProject]);
      
      // Limpiar el formulario
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateProjectModal(false);
      
      alert('Proyecto creado exitosamente');
    } catch (err) {
      console.error('Error al crear proyecto:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      alert('Error al crear proyecto: ' + errorMsg);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta organización? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.delete(`/organizations/${organizationId}`);
      alert('Organización eliminada');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error al eliminar organización:', err);
      alert('Error al eliminar organización: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteProject = async (projectId) => {
    setProjectToDelete(projectId);
    setShowDeleteProjectModal(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

     try {
       setDeletingProject(true);
       await api.delete(`/projects/${projectToDelete}`);
       
       // Remover el proyecto de la lista
       setProjects(projects.filter(p => p._id !== projectToDelete));
      
      setShowDeleteProjectModal(false);
      setProjectToDelete(null);
      alert('Proyecto eliminado exitosamente');
    } catch (err) {
      console.error('Error al eliminar proyecto:', err);
      alert('Error al eliminar proyecto: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeletingProject(false);
    }
  };

  const cancelDeleteProject = () => {
    setShowDeleteProjectModal(false);
    setProjectToDelete(null);
  };

   const isOrgAdmin = userRole === 'org_admin';

   const handleBack = () => {
     navigate('/dashboard');
   };

   const handleProjectClick = (projectId) => {
     navigate(`/projects/${projectId}`);
   };

   // ⭐ BLINDAJE CRÍTICO: Si algo está cargando o faltan datos, NO renderizar contenido
   // Esto evita expulsiones prematuras durante refresh silencioso
   if (loading || loadingOrg || !user || !organization) {
     return <div className="text-white p-6" style={{ textAlign: 'center', padding: '40px' }}>
       ⏳ Cargando organización...
     </div>;
   }

   if (error) {
     return (
       <div className="error-container">
         <p>{error}</p>
         <button className="btn btn-primary" onClick={handleBack}>
           Volver al Dashboard
         </button>
       </div>
     );
   }

  return (
    <div className="project-container">
      <div className="project-header">
        <div>
          <h1>📁 {organization?.name || 'Organización'}</h1>
          <p>{organization?.description || 'Sin descripción'}</p>
        </div>
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Volver
        </button>
      </div>

      <div className="project-content">
        <div className="tasks-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Proyectos ({projects.length})</h2>
            {isOrgAdmin && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateProjectModal(true)}
                title="Crear nuevo proyecto"
              >
                ➕ Nuevo Proyecto
              </button>
            )}
          </div>

          {isOrgAdmin && (
            <button 
              className="btn btn-danger btn-sm"
              onClick={handleDeleteOrganization}
              title="Eliminar esta organización"
              style={{ marginBottom: '15px' }}
            >
              🗑️ Eliminar Organización
            </button>
          )}

          {projects.length === 0 ? (
            <div className="no-tasks">
              <p>No hay proyectos en esta organización</p>
              {isOrgAdmin && <p style={{ marginTop: '10px' }}>Crea tu primer proyecto usando el botón "➕ Nuevo Proyecto"</p>}
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map((project) => (
                <div
                  key={project._id}
                  className="project-card"
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <div onClick={() => handleProjectClick(project._id)}>
                    <h3>{project.name}</h3>
                    <p>{project.description || 'Sin descripción'}</p>
                    <div className="project-status">
                      <span className="badge">{project.estado || 'activo'}</span>
                    </div>
                  </div>
                  {isOrgAdmin && (
                    <button
                      className="btn-delete-project"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project._id);
                      }}
                      title="Eliminar proyecto"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }

        .project-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          transition: all 0.3s ease;
        }

        .project-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .project-card h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .project-card p {
          color: #666;
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
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .btn-delete-project {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #ffebee;
          border: 1px solid #ef5350;
          color: #d32f2f;
          border-radius: 4px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-delete-project:hover {
          background: #ef5350;
          color: white;
        }

        .no-tasks {
          text-align: center;
          padding: 40px;
          background: #f5f5f5;
          border-radius: 8px;
          color: #999;
        }

        .error-container {
          padding: 40px;
          text-align: center;
        }

        .error-container p {
          color: #d32f2f;
          margin-bottom: 20px;
        }
      `}</style>

      {/* Modal para crear proyecto */}
      {showCreateProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Crear Nuevo Proyecto</h2>
              <button 
                className="modal-close"
                onClick={() => setShowCreateProjectModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="task-form">
              <div className="form-group">
                <label htmlFor="project-name">Nombre del Proyecto *</label>
                <input
                  id="project-name"
                  type="text"
                  placeholder="Ej: Mi Primer Proyecto"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="project-description">Descripción</label>
                <textarea
                  id="project-description"
                  placeholder="Describe brevemente tu proyecto"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCreateProjectModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCreateProject}
                disabled={creatingProject}
              >
                {creatingProject ? 'Creando...' : '✅ Crear Proyecto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para confirmar eliminación de proyecto */}
      {showDeleteProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>⚠️ Confirmar Eliminación</h2>
            </div>
            <div style={{ padding: '20px' }}>
              <p>¿Estás seguro de que deseas eliminar este proyecto?</p>
              <p style={{ color: '#d32f2f', fontSize: '14px', marginTop: '10px' }}>
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={cancelDeleteProject}
                disabled={deletingProject}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-danger"
                onClick={confirmDeleteProject}
                disabled={deletingProject}
              >
                {deletingProject ? 'Eliminando...' : '🗑️ Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Organization;
