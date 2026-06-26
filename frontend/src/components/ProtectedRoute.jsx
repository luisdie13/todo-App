import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * ProtectedRoute Component
 * Secures routing pipelines by validating active sessions and systemic role clearance.
 *
 * Implements standard guidelines:
 * - Prevents race conditions during token rotation by holding structural mounting.
 * - Restricts unauthorized system actions before network requests hit the cluster pipeline.
 *
 * Props:
 * - isAuthenticated : Boolean flag mirroring the existence of active sessions in memory
 * - isLoading       : Network lock flag indicating active authorization processing
 * - user            : Global authenticated user schema object containing system roles
 * - allowedRoles    : Optional array layer filtering access permissions dynamically (e.g., ['super_admin'])
 */
export const ProtectedRoute = ({ isAuthenticated, isLoading, user = null, allowedRoles = [] }) => {
  
  // Hold execution layout if the state engine is resolving refresh credentials
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0b0c10',
          color: '#ffffff',
          fontFamily: 'sans-serif'
        }}
        role="alert"
        aria-live="polite"
        aria-busy="true"
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '48px',
              marginBottom: '20px',
              display: 'inline-block',
              animation: 'spin 1s linear infinite',
            }}
          >
            ⏳
          </div>
          <p style={{ fontSize: '18px', letterSpacing: '0.5px' }}>Verifying secure session parameters…</p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Intercept routing if verification completes and tokens do not exist in the store
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Enforce systemic role boundaries (RBAC/ABAC interface governance rules)
  if (allowedRoles.length > 0) {
    const userRole = user?.role;
    const hasRolePermission = allowedRoles.includes(userRole);

    if (!hasRolePermission) {
      // Re-route unauthorized traffic automatically to prevent view exposure
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Grant routing passage to authorized components
  return <Outlet />;
};

export default ProtectedRoute;