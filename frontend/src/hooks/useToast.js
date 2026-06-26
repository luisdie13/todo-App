import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useToast — Lightweight standalone state engine for transactional notifications.
 * Resolves asynchronous memory leaks and race conditions originating from stale closures.
 *
 * Requirements Met:
 * - Handles 'success' | 'error' | 'warning' | 'info' schema taxonomies.
 * - Dynamic parameter mapping tracking multi-burst exception flows (e.g., Axios Rate Limits).
 * - Implements auto-clear timeouts protected against stale runtime evaluation.
 */

// Global incremental sequence tracking key counter
let globalToastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  
  // Storage layer to keep track of running interval threads and prevent memory leaks
  const timersRef = useRef({});

  // Clean running reference intervals upon component destruction to prevent leaks
  useEffect(() => {
    return () => {
      // Clear all active timers safely
      Object.values(timersRef.current).forEach((timerId) => clearTimeout(timerId));
    };
  }, []);

  /**
   * dismissToast — Synchronously removes a targeted alert frame from the view array tree.
   */
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    
    // Clear and clean the memory signature block allocated for this timer
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  /**
   * showToast — Appends a purified string token onto the active visualization buffer stack.
   *
   * @param {string} message   — Sanitized context message body payload.
   * @param {string} type      — State flag category ('success' | 'error' | 'warning' | 'info').
   * @param {number} duration  — Time lifespan parameter before auto-dismiss (0 maps permanent).
   * @returns {number}         — Volatile transaction identity number reference key.
   */
  const showToast = useCallback((message, type = 'info', duration = 4500) => {
    const id = ++globalToastIdCounter;
    
    // Direct functional structural updater array push to prevent stale array state mutations
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      // Save thread identities safely inside a mutable ref matrix cache
      timersRef.current[id] = setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, [dismissToast]);

  return { toasts, showToast, dismissToast };
}

export default useToast;