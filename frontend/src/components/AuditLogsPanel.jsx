import React, { useState, useEffect } from 'react';
import api from '../config/axios.config';
import '../styles/AuditLogsPanel.css';

function AuditLogsPanel() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' o 'stats'
  const [filters, setFilters] = useState({
    event: '',
    email: '',
    ip: ''
  });
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadLogs();
  }, [limit]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.append('limit', limit);

      if (filters.event) params.append('evento', filters.event);
      if (filters.email) params.append('email', filters.email);
      if (filters.ip) params.append('ip', filters.ip);

      const response = await api.get(`/admin/audit-logs?${params.toString()}`);
      setLogs(Array.isArray(response.data.logs) ? response.data.logs : []);
    } catch (err) {
      console.error('Error al cargar logs:', err);
      setError('Error al cargar logs de auditoría');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/admin/audit-stats');
      setStats(response.data.stats);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
      setError('Error al cargar estadísticas');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'stats' && !stats) {
      loadStats();
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleApplyFilters = () => {
    loadLogs();
  };

  const handleClearFilters = () => {
    setFilters({ event: '', email: '', ip: '' });
    setLimit(50);
  };

  const getEventIcon = (evento) => {
    const icons = {
      'auth.login.success': '✅',
      'auth.login.failure': '❌',
      'task.created': '📝',
      'task.updated': '✏️',
      'task.deleted': '🗑️',
      'task.marked_done': '✔️',
      'access.denied': '🚫',
      'audit.logs_viewed': '👁️',
      'audit.stats_viewed': '📊',
      'task.unauthorized_access': '⚠️'
    };
    return icons[evento] || '📌';
  };

  return (
    <div className="audit-logs-panel">
      <h2>🔐 Bitácora de Auditoría</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => handleTabChange('logs')}
        >
          📋 Logs
        </button>
        <button
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => handleTabChange('stats')}
        >
          📊 Estadísticas
        </button>
      </div>

      {activeTab === 'logs' && (
        <div className="logs-section">
          <div className="filters-panel">
            <div className="filter-group">
              <label>Evento:</label>
              <input
                type="text"
                placeholder="ej: auth.login.success"
                value={filters.event}
                onChange={(e) => handleFilterChange('event', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Email:</label>
              <input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={filters.email}
                onChange={(e) => handleFilterChange('email', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>IP:</label>
              <input
                type="text"
                placeholder="192.168.1.1"
                value={filters.ip}
                onChange={(e) => handleFilterChange('ip', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Límite:</label>
              <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <div className="filter-actions">
              <button className="btn btn-primary btn-sm" onClick={handleApplyFilters} disabled={loading}>
                🔍 Filtrar
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleClearFilters} disabled={loading}>
                ✕ Limpiar
              </button>
            </div>
          </div>

          <div className="logs-table">
            {loading ? (
              <p className="text-muted">Cargando logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-muted">Sin registros de auditoría</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Evento</th>
                      <th>Email</th>
                      <th>IP</th>
                      <th>Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <tr key={log._id || index}>
                        <td className="col-timestamp">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="col-event">
                          <span className="event-badge">
                            {getEventIcon(log.evento)} {log.evento}
                          </span>
                        </td>
                        <td className="col-email">{log.email || '-'}</td>
                        <td className="col-ip">{log.ip || '-'}</td>
                        <td className="col-details">
                          {log.detalles ? JSON.stringify(log.detalles).substring(0, 50) + '...' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="stats-section">
          {loading ? (
            <p className="text-muted">Cargando estadísticas...</p>
          ) : !stats ? (
            <p className="text-muted">Sin datos</p>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total de Logs</h3>
                  <div className="stat-value">{stats.totalLogs || 0}</div>
                </div>

                <div className="stat-card">
                  <h3>Últimas 24h</h3>
                  <div className="stat-value">{stats.logsLast24Hours || 0}</div>
                </div>

                <div className="stat-card alert-card">
                  <h3>Intentos Fallidos</h3>
                  <div className="stat-value">{stats.failedLogins || 0}</div>
                </div>
              </div>

              {stats.eventStats && stats.eventStats.length > 0 && (
                <div className="events-stats">
                  <h3>Eventos por Tipo</h3>
                  <div className="event-list">
                    {stats.eventStats.map((stat, index) => (
                      <div key={index} className="event-stat-item">
                        <span className="event-name">
                          {getEventIcon(stat._id)} {stat._id}
                        </span>
                        <div className="event-bar-container">
                          <div
                            className="event-bar"
                            style={{
                              width: `${(stat.count / Math.max(...stats.eventStats.map(s => s.count))) * 100}%`
                            }}
                          >
                            {stat.count}
                          </div>
                        </div>
                      </div>
                    ))}
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
