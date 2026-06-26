import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { logout } from '../services/authService';
import api from '../config/axios.config';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import AuditLogsPanel from '../components/AuditLogsPanel';
import UserManagementPanel from '../components/UserManagementPanel';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import '../styles/Dashboard.css';

const ADMIN_TAB_USERS = 'users';
const ADMIN_TAB_AUDIT = 'audit';

function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext);
  const { toasts, showToast, dismissToast } = useToast();

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState(ADMIN_TAB_USERS);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const sanitize = useCallback((value) => {
    if (!value) return '';
    return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  }, []);

  const loadOrganizations = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/organizations');
      const { created = [], memberOf = [] } = response.data;
      
      const orgMap = new Map();
      [...created, ...memberOf].forEach((org) => {
        if (org && org._id && !orgMap.has(org._id)) orgMap.set(org._id, org);
      });
      setOrganizations(Array.from(orgMap.values()));
    } catch (err) {
      console.error('[Dashboard] Error fetching:', err);
      setError('Failed to load organization perimeters.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    loadOrganizations();
  }, [user, authLoading, loadOrganizations, navigate]);

  const handleLogout = async () => {
    try { await logout(); } finally { onLogout(); navigate('/login'); }
  };

  const handleCreateOrganization = async () => {
    const cleanName = sanitize(newOrgName);
    const cleanDesc = sanitize(newOrgDescription);
    if (!cleanName) { showToast('Name is required.', 'warning'); return; }
    try {
      setCreatingOrg(true);
      const response = await api.post('/organizations', { name: cleanName, description: cleanDesc });
      setOrganizations((prev) => [...prev, response.data]);
      setShowCreateOrgModal(false);
      showToast('Organization created successfully.', 'success');
    } catch (err) {
      showToast('Failed to create organization.', 'error');
    } finally {
      setCreatingOrg(false);
    }
  };

  return (
    <div className="dashboard">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="container">
        {/* Sección de Organizaciones */}
        <div className="card">
          <h2>✨ My Organizations</h2>
          <button onClick={() => setShowCreateOrgModal(true)}>➕ New Organization</button>
          
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

      {showCreateOrgModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <input placeholder="Name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
            <textarea placeholder="Description" value={newOrgDescription} onChange={(e) => setNewOrgDescription(e.target.value)} />
            <button onClick={handleCreateOrganization} disabled={creatingOrg}>Create</button>
            <button onClick={() => setShowCreateOrgModal(false)}>Cancel</button>
          </div>
        </div>
      )}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default Dashboard;