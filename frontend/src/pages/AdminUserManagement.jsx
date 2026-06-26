import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import UserManagementPanel from '../components/UserManagementPanel';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import '../styles/AdminPages.css';

/**
 * AdminUserManagement — Dedicated full-page view container for the /admin/users route.
 * Secures workspace parameters by operating context state functions via memory allocation.
 *
 * Props:
 * - user: Authenticated system user instance object from memory store layout.
 * - onLogout: Destructive callback payload to flush secure operational memory tokens.
 */
function AdminUserManagement({ user, onLogout }) {
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext);
  const { toasts, showToast, dismissToast } = useToast();

  // ── Logout handler ──────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      onLogout();
      navigate('/login');
    }
  };

  // ── Context Layout State Mutator Synchronization ─────────────────────────
  const handleNavbarDashboardClick = () => {
    navigate('/dashboard', { replace: true });
  };

  const handleNavbarAdminUsersClick = () => {
    // Current route context is already active; do nothing or refresh local references
    console.log('[AdminUserManagement] User management route path context loop intercepted.');
  };

  const handleNavbarAdminAuditClick = () => {
    navigate('/admin/audit-logs', { replace: true });
  };

  // ── Enforced loading state block ─────────────────────────────────────────
  if (authLoading || user === null) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0b0c10',
          fontFamily: 'sans-serif'
        }}
        role="status" 
        aria-live="polite"
        aria-busy="true"
      >
        <p style={{ color: '#ffffff', fontSize: '18px' }}>Verifying operational administrative credentials…</p>
      </div>
    );
  }

  // Authoritative protection safeguard block (Enforced via ProtectedRoute baseline layer)
  if (user.role !== 'super_admin') return null;

  return (
    <div className="admin-page">

      {/* ── Top Navigation Bar — Bound dynamically with structural status update callbacks ── */}
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        onDashboardClick={handleNavbarDashboardClick}
        onAdminUsersClick={handleNavbarAdminUsersClick}
        onAdminAuditClick={handleNavbarAdminAuditClick}
      />

      {/* ── Main Layout Body Node ────────────────────────────────────────── */}
      <main className="admin-page__main" aria-labelledby="page-title">

        {/* ── Page Semantic Header ────────────────────────────────────────── */}
        <header className="admin-page__header">
          <nav className="admin-page__breadcrumb" aria-label="Breadcrumb navigation network trails">
            <span>Administration</span>
            <span className="admin-page__breadcrumb-sep" aria-hidden="true">›</span>
            <span className="admin-page__breadcrumb-current" aria-current="page">
              User Management
            </span>
          </nav>

          <h1 id="page-title" className="admin-page__title">
            👥 User Management
          </h1>
          <p className="admin-page__subtitle">
            View, search, and manage all system accounts. Use the <strong>Activate</strong> /&nbsp;
            <strong>Deactivate</strong> controls to toggle account access in real time.
            Every status change is securely recorded in the immutable audit log database registry.
          </p>
        </header>

        {/* ── Administrative Content Panel ────────────────────────────────── */}
        <div className="admin-page__content">
          <UserManagementPanel showToast={showToast} />
        </div>

      </main>

      {/* ── Toast stack (fixed, top-right) ───────────────────────────────── */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}

export default AdminUserManagement;