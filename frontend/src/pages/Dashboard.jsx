import React, { useState, useEffect } from 'react';
import { getMyOrganizations, createOrganization, deleteOrganization } from '../services/organizationService';
import { getUser } from '../services/tokenStorage';

const Dashboard = () => {
  const [organizations, setOrganizations] = useState({ created: [], memberOf: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [submitting, setSubmitting] = useState(false);
  const user = getUser();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);
    const result = await getMyOrganizations();
    if (result.success) {
      setOrganizations({ created: result.created, memberOf: result.memberOf });
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createOrganization(formData.nombre, formData.descripcion);
    
    if (result.success) {
      setFormData({ nombre: '', descripcion: '' });
      setShowCreateForm(false);
      await fetchOrganizations();
    } else {
      setError(result.error);
    }
    
    setSubmitting(false);
  };

  const handleDeleteOrganization = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta organización?')) {
      const result = await deleteOrganization(id);
      
      if (result.success) {
        await fetchOrganizations();
      } else {
        setError(result.error);
      }
    }
  };

  if (loading) {
    return <div className="dashboard"><p>Cargando organizaciones...</p></div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Bienvenido, {user?.email}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-section">
        <div className="section-header">
          <h2>Mis Organizaciones</h2>
          <button
            className="btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancelar' : '+ Nueva Organización'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateOrganization} className="create-org-form">
            <input
              type="text"
              placeholder="Nombre de la organización"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
              minLength="3"
            />
            <textarea
              placeholder="Descripción (opcional)"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows="3"
            />
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creando...' : 'Crear Organización'}
            </button>
          </form>
        )}

        {organizations.created.length === 0 ? (
          <p className="empty-state">Aún no has creado ninguna organización</p>
        ) : (
          <div className="organizations-grid">
            {organizations.created.map((org) => (
              <div key={org._id} className="org-card">
                <div className="org-card-header">
                  <h3>{org.nombre}</h3>
                  <span className={`badge badge-${org.estado}`}>{org.estado}</span>
                </div>
                {org.descripcion && <p className="org-description">{org.descripcion}</p>}
                <div className="org-meta">
                  <p>Miembros: {org.miembros.length}</p>
                </div>
                <div className="org-actions">
                  <button className="btn-secondary">Ver detalles</button>
                  <button 
                    className="btn-danger"
                    onClick={() => handleDeleteOrganization(org._id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {organizations.memberOf.length > 0 && (
        <div className="dashboard-section">
          <h2>Organizaciones donde eres miembro</h2>
          <div className="organizations-grid">
            {organizations.memberOf.map((org) => (
              <div key={org._id} className="org-card org-card-member">
                <div className="org-card-header">
                  <h3>{org.nombre}</h3>
                  <span className={`badge badge-${org.estado}`}>{org.estado}</span>
                </div>
                {org.descripcion && <p className="org-description">{org.descripcion}</p>}
                <div className="org-meta">
                  <p>Creador: {org.creador.email}</p>
                  <p>Miembros: {org.miembros.length}</p>
                </div>
                <div className="org-actions">
                  <button className="btn-secondary">Ver detalles</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
