import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import adminService from '../services/adminService';
import '../styles/AuditLogsPanel.css';

// ── DOMPurify strict helper ────────────────────────────────────────────────
/**
 * sanitize — strips all HTML tags and attributes from a dynamic string before
 * it is inserted into a React text node to prevent cross-site scripting (XSS).
 */
const sanitize = (value) => {
  if (value === null || value === undefined) return '—';
  return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
};

// ── Event icon metadata dictionary mappings ────────────────────────────────
const EVENT_ICONS = {
  'auth.register':              '📝',
  'auth.login.success':         '✅',
  'auth.login.failure':         '❌',
  'auth.logout':                '🚪',
  'auth.token.refresh':         '🔄',
  'task.create':                '📝',
  'task.update':                '✏️',
  'task.delete':                '🗑️',
  'task.status_change':         '🔄',
  'org.member.add':             '➕',
  'org.member.remove':          '➖',
  'security.unauthorized':      '🔒',
  'security.rate_limited':      '⏳',
  'user.deactivated':           '🔴',
  'user.activated':             '🟢'
};

const getEventIcon = (event) => EVENT_ICONS[sanitize(event)] || '📌';

// ── Payload detail cell (Strict Metadata Render) ───────────────────────────
function PayloadCell({ payload }) {
  const [expanded, setExpanded] = useState(false);

  if (!payload) return <span className="log-empty">—</span>;

  const raw = JSON.stringify(payload, null, 2);
  const preview = raw.length > 50 ? `${raw.substring(0, 50)}…` : raw;

  return (
    <button
      type="button"
      className={`payload-cell ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded((v) => !v)}
      title={expanded ? 'Click to collapse payload details' : 'Click to expand payload details'}
      aria-expanded={expanded}
      aria-label={expanded ? 'Collapse payload metadata details' : 'Expand payload metadata details'}
      style={{
        fontFamily: 'monospace',
        whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
        textAlign: 'left',
        wordBreak: 'break-all'
      }}
    >
      {expanded ? DOMPurify.sanitize(raw, { ALLOWED_TAGS: [] }) : DOMPurify.sanitize(preview, { ALLOWED_TAGS: [] })}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
function AuditLogsPanel() {
  const [logs, setLogs]             = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [activeTab, setActiveTab]   = useState('logs');
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  const [filters, setFilters]       = useState({ event: '', email: '', ip: '' });
  const [limit, setLimit]           = useState(50);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── Live countdown interval tracking for rate limitations ────────────────
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  // ── Fetch global audit logs (Protected administrative passage) ───────────
  const loadLogs = useCallback(async () => {
    if (rateLimitSeconds > 0) return;
    try {
      setLoading(true);
      setError('');
      const response = await adminService.getGlobalAuditLogs({ limit, page, ...filters });
      setLogs(Array.isArray(response.docs) ? response.docs : Array.isArray(response) ? response : []);
      setTotalPages(response.totalPages ?? 1);
    } catch (err) {
      console.error('[AuditLogsPanel] Failed to retrieve system logs:', err);
      
      if (err.response?.status === 429) {
        const retryValue = parseInt(err.response.headers['retry-after'] || '60', 10);
        setRateLimitSeconds(retryValue);
        setError('Audit lookup pipeline velocity threshold reached.');
        return;
      }

      setError(err.response?.data?.error || 'Access Denied: Failed to retrieve secure system audit trails.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [limit, page, filters, rateLimitSeconds]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
  }, [activeTab, page, limit]); // Re-fetch triggers smoothly upon page mutation parameters

  // ── Fetch statistics context ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminService.getAuditStats();
      setStats(response.stats || response.data?.stats || response);
    } catch (err) {
      console.error('[AuditLogsPanel] Error parsing statistics payload:', err);
      setError('Failed to compute analytical event metrics from system database.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Tab switching engine ─────────────────────────────────────────────────
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    if (tab === 'stats') loadStats();
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters({ event: '', email: '', ip: '' });
    setLimit(50);
    setPage(1);
    setError('');
  };

  return (
    <div className="audit-logs-panel">
      <div className="panel-header">
        <h2>🔐 Global Audit Log Viewer</h2>
        <p className="panel-subtitle">
          Secured Immutable Event Log Ledger. System actions, session boundaries, and transactional state mutations are recorded automatically.
        </p>
      </div>

      {/* ── Security Alert Banners ──────────────────────────────────────── */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {sanitize(error)}
        </div>
      )}

      {rateLimitSeconds > 0 && (
        <div className="alert alert-warning" role="alert">
          ⏳ <strong>Resource Consumption Restricted:</strong> Súper Admin lookup velocity threshold reached. Please wait <strong>{rateLimitSeconds}s</strong> before parsing logs again.
        </div>
      )}

      {/* ── Tab Layout System Navigation ────────────────────────────────── */}
      <div className="tabs" role="tablist" aria-label="Audit log sections">
        <button
          role="tab"
          aria-selected={activeTab === 'logs'}
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => handleTabChange('logs')}
          disabled={loading}
          type="button"
        >
          📋 System Log Records
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'stats'}
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => handleTabChange('stats')}
          disabled={loading}
          type="button"
        >
          📊 Aggregated Analytics
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LOG RECORDS PANEL TAB VIEW
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'logs' && (
        <div className="logs-section">

          {/* ── Filter Execution Core Board ───────────────────────────────── */}
          <div className="filters-panel" role="search" aria-label="Filter audit logs">
            <div className="filter-group">
              <label htmlFor="filter-event">Action Parameter</label>
              <input
                id="filter-event"
                type="text"
                placeholder="e.g.: auth.login.failure"
                value={filters.event}
                onChange={(e) => handleFilterChange('event', e.target.value)}
                disabled={loading || rateLimitSeconds > 0}
                autoComplete="off"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="filter-email">Actor Identity Email</label>
              <input
                id="filter-email"
                type="email"
                placeholder="operator@company.com"
                value={filters.email}
                onChange={(e) => handleFilterChange('email', e.target.value)}
                disabled={loading || rateLimitSeconds > 0}
                autoComplete="off"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="filter-ip">Network IP Address</label>
              <input
                id="filter-ip"
                type="text"
                placeholder="127.0.0.1"
                value={filters.ip}
                onChange={(e) => handleFilterChange('ip', e.target.value)}
                disabled={loading || rateLimitSeconds > 0}
                autoComplete="off"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="filter-limit">Page Grid Limit</label>
              <select
                id="filter-limit"
                value={limit}
                onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
                disabled={loading || rateLimitSeconds > 0}
              >
                <option value={25}>25 Rows</option>
                <option value={50}>50 Rows</option>
                <option value={100}>100 Rows</option>
              </select>
            </div>

            <div className="filter-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={loadLogs}
                disabled={loading || rateLimitSeconds > 0}
                type="button"
              >
                🔍 Query Registry
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearFilters}
                disabled={loading || rateLimitSeconds > 0}
                type="button"
              >
                ✕ Flush
              </button>
            </div>
          </div>

          {/* ── Encapsulated Clean Grid Table Layout ──────────────────────── */}
          <div className="logs-table">
            {loading && logs.length === 0 ? (
              <p className="text-muted">Fetching transactional history trails from MongoDB instance…</p>
            ) : logs.length === 0 ? (
              <p className="text-muted">No secure audit trails locate matching the parameters specified.</p>
            ) : (
              <div className="table-wrapper">
                <table aria-label="Secure System Audit Trails">
                  <thead>
                    <tr>
                      <th scope="col">Timestamp</th>
                      <th scope="col">Action (Event)</th>
                      <th scope="col">Actor Operator</th>
                      <th scope="col">Resource Model</th>
                      <th scope="col">Target ID</th>
                      <th scope="col">IP Gateway</th>
                      <th scope="col">User Agent Browser Signature</th>
                      <th scope="col">Payload Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => {
                      const actorEmail = sanitize(log.actorId?.email || log.operator?.email || log.email || 'System Perimeter');
                      const eventName  = sanitize(log.action || log.event);
                      const modelType  = sanitize(log.resourceType || (eventName.split('.')?.[0] ?? '—'));
                      const modelDisplay = modelType !== '—' ? modelType.toUpperCase() : '—';
                      
                      const targetId   = sanitize(log.resourceId || log.payload?.resourceId || '—');
                      const shortTargetId = targetId !== '—' && targetId.length > 12 ? `…${targetId.slice(-6)}` : targetId;
                      
                      const ipAddress  = sanitize(log.ip);
                      const userAgent  = sanitize(log.userAgent);

                      return (
                        <tr key={log._id || `log-row-${idx}`}>
                          {/* Chronological Timestamp Node */}
                          <td className="col-timestamp">
                            {log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19) : '—'}
                          </td>

                          {/* Action badge classification */}
                          <td className="col-event">
                            <span className="event-badge">
                              <span aria-hidden="true" style={{ marginRight: '4px' }}>{getEventIcon(eventName)}</span>
                              <code>{eventName}</code>
                            </span>
                          </td>

                          <td className="col-email">{actorEmail}</td>
                          <td className="col-resource-type"><strong>{modelDisplay}</strong></td>
                          
                          <td className="col-resource-id">
                            <span className="resource-id-cell" title={targetId !== '—' ? targetId : undefined}>
                              {shortTargetId}
                            </span>
                          </td>
                          
                          <td className="col-ip"><code>{ipAddress}</code></td>

                          {/* Browser footprint tracking metadata */}
                          <td className="col-ua">
                            <span className="ua-cell" title={userAgent !== '—' ? userAgent : undefined}>
                              {userAgent !== '—' && userAgent.length > 30 ? `${userAgent.substring(0, 30)}…` : userAgent}
                            </span>
                          </td>

                          {/* Raw Expandable JSON metadata container payload */}
                          <td className="col-details">
                            <PayloadCell payload={log.metadata || log.payload} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Micro-grid pagination components ────────────────────────── */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                type="button"
              >
                ‹ Previous
              </button>
              <span>Page <strong>{page}</strong> of {totalPages}</span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                type="button"
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          AGGREGATED METRICS PANEL TAB VIEW
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stats' && (
        <div className="stats-section">
          {loading ? (
            <p className="text-muted">Computing real-time cryptographic analytics aggregates…</p>
          ) : !project && comments.length === 0 && (!comments || comments.length === 0) ? (
            <p className="text-muted">No ledger audit activity tracked yet.</p>
          ) : (
            <>
              {/* Summary telemetry grids cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Cumulative Ledger Volume</h3>
                  <div className="stat-value">{stats?.totalLogs || logs.length || 0}</div>
                </div>
                <div className="stat-card">
                  <h3>Activity Burst (Last 24h)</h3>
                  <div className="stat-value">{stats?.logsLast24Hours || 0}</div>
                </div>
                <div className="stat-card alert-card">
                  <h3>Brute-Force Exceptions</h3>
                  <div className="stat-value">{stats?.failedLogins || 0}</div>
                </div>
              </div>

              {/* Dynamic progressive analytic tracking charts layout */}
              {stats?.eventStats?.length > 0 && (
                <div className="events-stats">
                  <h3>Event Call Frequency Density Bar Chart</h3>
                  <div className="event-list">
                    {stats.eventStats.map((stat, idx) => {
                      const eventKey = sanitize(stat.event || stat._id || 'unknown');
                      const maxCount = Math.max(...stats.eventStats.map((s) => s.count), 1);
                      
                      return (
                        <div key={`stat-item-${idx}`} className="event-stat-item">
                          <span className="event-name">
                            <span aria-hidden="true" style={{ marginRight: '6px' }}>{getEventIcon(eventKey)}</span>
                            <code>{eventKey}</code>
                          </span>
                          <div
                            className="event-bar-container"
                            role="progressbar"
                            aria-valuenow={stat.count}
                            aria-valuemin={0}
                            aria-valuemax={maxCount}
                            aria-label={`Analytical frequency density metric for ${eventKey}: ${stat.count} items.`}
                          >
                            <div
                              className="event-bar"
                              style={{ width: `${(stat.count / maxCount) * 100}%` }}
                            >
                              {stat.count}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AuditLogsPanel;