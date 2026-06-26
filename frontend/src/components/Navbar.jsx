import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navbar.css';

/**
 * Navbar — sticky top navigation bar for SecureCollab.
 * Centraliza la navegación mediante el prop 'onNavigate'.
 */
function Navbar({ user, onLogout, onNavigate, activeView }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';

  const closeMenu = () => setMenuOpen(false);

  // Manejador unificado para cambios de vista
  const handleNavigate = (view) => {
    closeMenu();
    if (onNavigate) onNavigate(view);
  };

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <div className="navbar__brand">
        <Link to="/dashboard" className="navbar__logo" onClick={() => handleNavigate('dashboard')}>
          🔒 SecureCollab
        </Link>
      </div>

      {/* Hamburger toggle */}
      <button
        className={`navbar__hamburger${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle navigation menu"
      >
        <span /><span /><span />
      </button>

      {/* Navigation links */}
      <ul className={`navbar__links${menuOpen ? ' navbar__links--open' : ''}`}>
        <li>
          <button
            className={`navbar__link ${activeView === 'dashboard' ? 'navbar__link--active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
          >
            🏠 Dashboard
          </button>
        </li>

        {isSuperAdmin && (
          <>
            <li className="navbar__divider" />
            <li>
              <button
                className={`navbar__link ${activeView === 'users' ? 'navbar__link--active' : ''}`}
                onClick={() => handleNavigate('users')}
              >
                👥 User Management
              </button>
            </li>
            <li>
              <button
                className={`navbar__link ${activeView === 'audit' ? 'active' : ''}`}
                onClick={() => handleNavigate('audit')}
              >
                🔐 Audit Logs
              </button>
            </li>
          </>
        )}
      </ul>

      {/* User identity + logout */}
      <div className="navbar__right">
        {user && (
          <span className="navbar__user">
            {user.email}
            {isSuperAdmin && <span className="navbar__badge">⚡ Super Admin</span>}
          </span>
        )}
        <button className="navbar__logout" onClick={onLogout}>
          🚪 Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;