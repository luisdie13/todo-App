import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../config/axios.config';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import AuditLogsPanel from '../components/AuditLogsPanel';
import UserManagementPanel from '../components/UserManagementPanel';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import '../styles/Dashboard.css';

function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext);
  const { toasts, showToast, dismissToast } = useToast();

  const [activeView, setActiveView] = useState('dashboard');
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estado para el modal de nueva organización
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  const isSuperAdmin = user?.role === 'super_admin';

  const loadOrganizations = useCallback(async () => {
    if (!user || activeView !== 'dashboard') return;
    try {
      setLoading(true);
      const response = await api.get('/organizations');
      const { created = [], memberOf = [] } = response.data;
      setOrganizations([...created, ...memberOf]);
    } catch (err) {
      console.error('[Dashboard] Error fetching:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeView]);

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    try {
      await api.post('/organizations', { name: newOrgName });
      setShowCreateOrgModal(false);
      setNewOrgName('');
      showToast('Organization created successfully!', 'success');
      loadOrganizations();
    } catch (err) {
      showToast('Failed to create organization', 'error');
    }
  };

  useEffect(() => {
    if (!authLoading && user && activeView === 'dashboard') loadOrganizations();
  }, [user, authLoading, activeView, loadOrganizations]);

  return (
    <div className="dashboard">
      <Navbar 
        user={user} 
        onLogout={onLogout} 
        onNavigate={(view) => setActiveView(view)} 
        activeView={activeView}
      />
      
      <div className="container">
        {activeView === 'dashboard' && (
          <div className="card">
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>✨ My Organizations</h2>
              <button className="btn btn-primary" onClick={() => setShowCreateOrgModal(true)}>
                ➕ New Organization
              </button>
            </div>
            
            {loading ? <p>Loading...</p> : (
              <div className="org-list">
                {organizations.map((org) => (
                  <div key={org._id} className="org-card">
                    <h3>{DOMPurify.sanitize(org.name)}</h3>
                    <button onClick={() => navigate(`/organization/${org._id}`)}>View Projects</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'users' && isSuperAdmin && <UserManagementPanel />}
        {activeView === 'audit' && isSuperAdmin && <AuditLogsPanel />}
      </div>

      {/* Modal de creación */}
      {showCreateOrgModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateOrganization}>
            <h3>Create New Organization</h3>
            <input 
              value={newOrgName} 
              onChange={(e) => setNewOrgName(e.target.value)} 
              placeholder="Organization Name" 
              required 
            />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCreateOrgModal(false)}>Cancel</button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default Dashboard;