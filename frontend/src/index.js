import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Application Entry Point — SecureCollab Frontend.
 * Binds the main reactive SPA node tree cleanly to the public index DOM root element.
 * Enforces React.StrictMode to capture memory leaks and stale lifecycle effect hooks during development cycles.
 */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);