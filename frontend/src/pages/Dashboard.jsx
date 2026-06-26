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

  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  
  // Estados para el panel de Admin
  const [activeTab, setActiveTab] = useState('users'); 

  const isSuperAdmin = user?.role === 'super_admin';

  const sanitize = useCallback((value) => {
    return value ? DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [] }).trim() : '';
  }, []);

  const loadOrganizations = useCallback(async () => {
    if (!user) return;
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
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) loadOrganizations();
  }, [user, authLoading, loadOrganizations]);

  return (
    <div className="dashboard">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="container">
        {/* 1. Panel de Super Admin (Solo si es role super_admin) */}
        {isSuperAdmin && (
          <div className="card admin-panel-card">
            <div className="admin-tabs">
              <button className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>User Management</button>
              <button className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Logs</button>
            </div>
            <div className="admin-tab-content">
              {activeTab === 'users' ? <UserManagementPanel /> : <AuditLogsPanel />}
            </div>
          </div>
        )}

        {/* 2. Sección de Organizaciones */}
        <div className="card">
          <h2>✨ My Organizations</h2>
          <button className="btn" onClick={() => setShowCreateOrgModal(true)}>➕ New Organization</button>
          {loading ? <p>Loading...</p> : (
            <div className="org-list">
              {organizations.map((org) => (
                <div key={org._id} className="org-card">
                  <h3>{sanitize(org.name)}</h3>
                  <button onClick={() => navigate(`/organization/${org._id}`)}>View Projects</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* ... Modal y Toast igual que antes ... */}
    </div>
  );
}

export default Dashboard;