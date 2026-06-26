import React from 'react';
import '../styles/Toast.css';

const TYPE_ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};

/**
 * Toast — renders a fixed, stacked list of dismissible toast notifications.
 *
 * Props:
 *   toasts    — array of { id: number, message: string, type: string }
 *   onDismiss — (id: number) => void
 */
function Toast({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}`}
          role="alert"
          aria-live="assertive"
        >
          <span className="toast__icon" aria-hidden="true">
            {TYPE_ICONS[t.type] ?? 'ℹ️'}
          </span>
          <span className="toast__message">{t.message}</span>
          <button
            className="toast__dismiss"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            type="button"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toast;
