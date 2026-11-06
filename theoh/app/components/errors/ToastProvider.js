"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle, AlertTriangle, Info, XCircle, X } from "lucide-react";

/**
 * ToastProvider — Lightweight toast notification system.
 * Supports success, error, warning, info types.
 * Auto-dismiss with configurable duration. Stacks up to 3 toasts.
 * Accessible with aria-live.
 */

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if not in provider
    return { showToast: () => {} };
  }
  return context;
}

const TOAST_ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4000;

let toastIdCounter = 0;

function ToastItem({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (toast.duration !== Infinity) {
      timerRef.current = setTimeout(dismiss, toast.duration || DEFAULT_DURATION);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, toast.duration]);

  const IconComponent = TOAST_ICONS[toast.type] || Info;

  return (
    <div
      className={`toast-item toast-item--${toast.type}${isExiting ? " toast-item--exit" : ""}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-item-icon" aria-hidden="true">
        <IconComponent size={18} />
      </div>
      <div className="toast-item-body">
        {toast.title && <strong className="toast-item-title">{toast.title}</strong>}
        <span className="toast-item-message">{toast.message}</span>
      </div>
      <button
        type="button"
        className="toast-item-close"
        onClick={dismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ type = "info", title, message, duration }) => {
    const id = ++toastIdCounter;
    setToasts((prev) => {
      const next = [...prev, { id, type, title, message, duration: duration || DEFAULT_DURATION }];
      // Keep only the most recent MAX_TOASTS
      if (next.length > MAX_TOASTS) {
        return next.slice(next.length - MAX_TOASTS);
      }
      return next;
    });
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {toasts.length > 0 && (
        <div className="toast-container" aria-label="Notifications">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
