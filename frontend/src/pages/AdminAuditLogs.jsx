import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import AuditLogsPanel from '../components/AuditLogsPanel';
import '../styles/AdminPages.css';

/**
 * AdminAuditLogs — Full-page view container for the dedicated /admin/audit-logs route.
 * Secures workspace parameters by operating context state functions via memory allocation.
 *
 * Props:
 * - user: Authenticated system user instance object from memory store layout.
 * - onLogout: Destructive callback payload to flush secure operational memory tokens.
 */
function AdminAuditLogs({ user, onLogout }) {
  const navigate = useNavigate();
  const { authLoading } = useContext(AuthContext);

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
    navigate('/admin/users', { replace: true });
  };

  const handleNavbarAdminAuditClick = () => {
    // Current route context is already active; do nothing or refresh records local references
    console.log('[AdminAuditLogs] Audit logging route path context loop intercepted.');
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
              Audit Logs
            </span>
          </nav>

          <h1 id="page-title" className="admin-page__title">
            🔐 Audit Logs Registry Ledger
          </h1>
          <p className="admin-page__subtitle">
            Immutable, tamper-proof system event history database records for the entire SecureCollab workspace. 
            Monitors authentication cycles, transactional state status mutations, cryptographic data adjustments, and 
            unauthorized authorization failures in real time.
          </p>
        </header>

        {/* ── Analytical Data Content Panel ────────────────────────────────── */}
        <div className="admin-page__content">
          <AuditLogsPanel />
        </div>

      </main>

    </div>
  );
}

export default AdminAuditLogs;