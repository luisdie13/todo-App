import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';
import api from '../config/axios.config';
import { AuthContext } from '../context/AuthContext';
import AuditLogsPanel from '../components/AuditLogsPanel';
import '../styles/Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext); // ✅ NUEVO: Obtener authLoading del contexto
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // ✅ CRÍTICO: El useEffect ahora depende de [user, authLoading]
  // De esta forma, cuando el usuario vuelve a estar disponible tras un refresh (F5),
  // este efecto se ejecuta nuevamente y re-dispara la carga de datos
  useEffect(() => {
    // Si el estado global de autenticación todavía está cargando, o no hay usuario, espera.
    if (authLoading || !user) {
      console.log('⏳ [Dashboard] Esperando autenticación... authLoading:', authLoading, 'user:', !!user);
      return;
    }

    loadOrganizations();
  }, [user, authLoading]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/organizations');
      // Backend devuelve { created, memberOf }, combinarlos
      const { created = [], memberOf = [] } = response.data;
      // Eliminar duplicados usando Map por _id
      const orgMap = new Map();
      [...created, ...memberOf].forEach(org => {
        if (!orgMap.has(org._id)) {
          orgMap.set(org._id, org);
        }
      });
      const allOrganizations = Array.from(orgMap.values());
      setOrganizations(allOrganizations);
    } catch (err) {
      setError('Error al cargar organizaciones');
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onLogout();
    navigate('/login');
  };

  const isSuperAdmin = user?.rol === 'super_admin';

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      alert('El nombre de la organización es requerido');
      return;
    }

    try {
      setCreatingOrg(true);
      const response = await api.post('/organizations', {
        name: newOrgName,
        description: newOrgDescription
      });
      
      // Agregar la nueva organización a la lista
      setOrganizations([...organizations, response.data]);
      
      // Limpiar el formulario
      setNewOrgName('');
      setNewOrgDescription('');
      setShowCreateOrgModal(false);
      
      alert('Organización creada exitosamente');
    } catch (err) {
      console.error('Error al crear organización:', err);
      alert('Error al crear organización: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreatingOrg(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="header">
        <div>
          <h1>🔒 SecureCollab</h1>
          <p>
            Usuario: <strong>{user?.email || 'Usuario'}</strong>
            {isSuperAdmin && <span className="badge-admin">Super Admin</span>}
          </p>
        </div>
        <div className="header-buttons">
          {isSuperAdmin && (
            <button
              className="btn btn-warning"
              onClick={() => setShowAuditLogs(!showAuditLogs)}
            >
              🔐 {showAuditLogs ? 'Ocultar' : 'Ver'} Auditoría
            </button>
          )}
          <button className="btn btn-danger" onClick={handleLogout}>
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="container">
        <div className="card welcome-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>✨ Mis Organizaciones</h2>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateOrgModal(true)}
              title="Crear nueva organización"
            >
              ➕ Nueva Organización
            </button>
          </div>
          
          {error && <div className="alert alert-danger">{error}</div>}
          
          {loading ? (
            <p className="text-muted">Cargando organizaciones...</p>
          ) : !Array.isArray(organizations) || organizations.length === 0 ? (
            <p className="text-muted">No tienes organizaciones aún. Crea una para comenzar.</p>
          ) : (
            <div className="org-list">
              {organizations.map((org) => (
                <div key={org._id} className="org-card">
                  <h3>{org.name}</h3>
                  <p>{org.description || 'Sin descripción'}</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/organization/${org._id}`)}
                  >
                    Ver Proyectos →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>


        <div className="card alert alert-info">
          <h3>ℹ️ Seguridad Implementada</h3>
          <ul>
            <li>✅ Autenticación JWT</li>
            <li>✅ Token Rotation automático</li>
            <li>✅ Revocación en logout</li>
            <li>✅ Rate limiting (5 intentos/15 min)</li>
            <li>✅ AES-256-GCM para datos sensibles</li>
            <li>✅ Auditoría completa</li>
            <li>✅ OWASP Top 10 mitigado</li>
          </ul>
        </div>

        <div className="card security-details">
          <h3>🔐 Detalles Técnicos de Seguridad</h3>
          
          <div className="tech-grid">
            <div className="tech-item">
              <strong>Encriptación en Reposo</strong>
              <p>AES-256-GCM para project.description y task.description (si sensitive=true)</p>
              <code>ENCRYPTION_KEY: 64 chars hex</code>
            </div>
            
            <div className="tech-item">
              <strong>Gestión de Tokens</strong>
              <p>AccessToken: 15 min | RefreshToken: 7 días</p>
              <code>Almacenados en memoria (NO localStorage)</code>
            </div>

            <div className="tech-item">
              <strong>Rate Limiting</strong>
              <p>Login: 5 intentos/15 min | Registro: 3/hora | Comentarios: 20/min</p>
              <code>Respuesta 429 con Retry-After</code>
            </div>

            <div className="tech-item">
              <strong>Validación de Inputs</strong>
              <p>DOMPurify en frontend | Joi en backend</p>
              <code>Prevención de XSS e Injection</code>
            </div>
          </div>
        </div>

        <div className="quick-start-guide">
          <h3>📖 Guía Rápida</h3>
          
          <div className="guide-steps">
            <div className="guide-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <strong>Dashboard</strong>
                <p>Visualiza tus organizaciones. Sin organizaciones aún? Crea una.</p>
              </div>
            </div>

            <div className="guide-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <strong>Proyecto</strong>
                <p>Dentro de una org, accede a proyectos y tareas.</p>
              </div>
            </div>

            <div className="guide-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <strong>Crear Tarea</strong>
                <p>Botón "+ Nueva tarea". Marca como sensitive para cifrar.</p>
              </div>
            </div>

            <div className="guide-step">
              <div className="step-number">4</div>
              <div className="step-content">
                <strong>Comentarios</strong>
                <p>En detalle de tarea, agrega comentarios (máx 20/min).</p>
              </div>
            </div>

            <div className="guide-step">
              <div className="step-number">5</div>
              <div className="step-content">
                <strong>Logout</strong>
                <p>Botón "Cerrar Sesión" revoca tokens. Redirección a login.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Auditoría - Solo para super_admin */}
        {showAuditLogs && isSuperAdmin && (
          <div className="card audit-card">
            <AuditLogsPanel />
          </div>
        )}
      </div>

      {/* Modal para crear organización */}
      {showCreateOrgModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Crear Nueva Organización</h2>
              <button 
                className="modal-close"
                onClick={() => setShowCreateOrgModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="task-form">
              <div className="form-group">
                <label htmlFor="org-name">Nombre de la Organización *</label>
                <input
                  id="org-name"
                  type="text"
                  placeholder="Ej: Mi Empresa"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="org-description">Descripción</label>
                <textarea
                  id="org-description"
                  placeholder="Describe brevemente tu organización"
                  value={newOrgDescription}
                  onChange={(e) => setNewOrgDescription(e.target.value)}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCreateOrgModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCreateOrganization}
                disabled={creatingOrg}
              >
                {creatingOrg ? 'Creando...' : '✅ Crear Organización'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
