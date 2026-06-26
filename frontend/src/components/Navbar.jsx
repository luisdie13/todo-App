import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';

/**
 * Navbar — sticky top navigation bar for SecureCollab.
 *
 * Conditional rendering rules:
 * - "🏠 Dashboard"      → always visible for authenticated users
 * - "👥 User Management" → ONLY rendered when user.role === 'super_admin'
 * - "🔐 Audit Logs"      → ONLY rendered when user.role === 'super_admin'
 *
 * Normal users (role: 'user') will NEVER see the admin-exclusive links.
 *
 * Props:
 * user              — authenticated user object ({ email, role, ... }) from memory store
 * onLogout          — callback: executes token clear + redirect to /login
 * onDashboardClick  — callback: resets layout when dashboard link is pressed
 * onAdminUsersClick — callback: updates active tab layout to user management panel
 * onAdminAuditClick — callback: updates active tab layout to audit logs panel
 */
function Navbar({ user, onLogout, onDashboardClick, onAdminUsersClick, onAdminAuditClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isSuperAdmin = user?.role === 'super_admin';

  /** Returns true if the current path starts with the given prefix. */
  const isActive = (path) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(path);

  const closeMenu = () => setMenuOpen(false);

  // ── Unified handlers to manage mobile menu toggle and context lifting ──
  const handleDashboardAction = () => {
    closeMenu();
    if (onDashboardClick) onDashboardClick();
  };

  const handleAdminUsersAction = () => {
    closeMenu();
    if (onAdminUsersClick) onAdminUsersClick();
  };

  const handleAdminAuditAction = () => {
    closeMenu();
    if (onAdminAuditClick) onAdminAuditClick();
  };

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">

      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div className="navbar__brand">
        <Link to="/dashboard" className="navbar__logo" onClick={handleDashboardAction}>
          🔒 SecureCollab
        </Link>
      </div>

      {/* ── Mobile hamburger toggle ─────────────────────────────────────────── */}
      <button
        className={`navbar__hamburger${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>

      {/* ── Navigation links ────────────────────────────────────────────────── */}
      <ul
        className={`navbar__links${menuOpen ? ' navbar__links--open' : ''}`}
        role="list"
      >
        {/* Dashboard — visible to all authenticated users */}
        <li role="listitem">
          <Link
            to="/dashboard"
            className={`navbar__link${isActive('/dashboard') ? ' navbar__link--active' : ''}`}
            onClick={handleDashboardAction}
            aria-current={isActive('/dashboard') ? 'page' : undefined}
          >
            🏠 Dashboard
          </Link>
        </li>

        {/* ── super_admin exclusive section ─────────────────────────────────── */}
        {isSuperAdmin && (
          <>
            {/* Visual separator between regular and admin links */}
            <li className="navbar__divider" role="separator" aria-hidden="true" />

            {/* User Management — /admin/users */}
            <li role="listitem">
              <Link
                to="/dashboard"
                className={`navbar__link navbar__link--admin${
                  isActive('/admin/users') ? ' navbar__link--active' : ''
                }`}
                onClick={handleAdminUsersAction}
                aria-current={isActive('/admin/users') ? 'page' : undefined}
              >
                👥 User Management
              </Link>
            </li>

            {/* Audit Logs — /admin/audit-logs */}
            <li role="listitem">
              <Link
                to="/dashboard"
                className={`navbar__link navbar__link--admin${
                  isActive('/admin/audit-logs') ? ' navbar__link--active' : ''
                }`}
                onClick={handleAdminAuditAction}
                aria-current={isActive('/admin/audit-logs') ? 'page' : undefined}
              >
                🔐 Audit Logs
              </Link>
            </li>
          </>
        )}
      </ul>

      {/* ── Right section: user identity + logout ──────────────────────────── */}
      <div className="navbar__right">
        {user && (
          <span className="navbar__user" title={user.email}>
            {user.email}
            {isSuperAdmin && (
              <span className="navbar__badge" aria-label="Super Administrator">
                ⚡ Super Admin
              </span>
            )}
          </span>
        )}
        <button
          className="navbar__logout"
          onClick={onLogout}
          type="button"
          aria-label="Sign out of SecureCollab"
        >
          🚪 Logout
        </button>
      </div>

    </nav>
  );
}

export default Navbar;