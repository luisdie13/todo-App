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

  // Gestión centralizada de vista
  const [activeView, setActiveView] = useState('dashboard'); 
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const loadOrganizations = useCallback(async () => {
    if (!user || activeView !== 'dashboard') return;
    try {
      setLoading(true);
      const response = await api.get('/organizations');
      const { created = [], memberOf = [] } = response.data;
      setOrganizations([...created, ...memberOf]);
    } catch (err) {
      console.error('[Dashboard] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeView]);

  useEffect(() => {
    if (!authLoading && user && activeView === 'dashboard') loadOrganizations();
  }, [user, authLoading, activeView, loadOrganizations]);

  return (
    <div className="dashboard">
      {/* Navbar ahora recibe el control de navegación */}
      <Navbar 
        user={user} 
        onLogout={onLogout} 
        onNavigate={(view) => setActiveView(view)} 
        activeView={activeView}
      />
      
      <div className="container">
        {/* Renderizado Condicional Exclusivo */}
        {activeView === 'dashboard' && (
          <div className="card">
            <h2>✨ My Organizations</h2>
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
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default Dashboard;