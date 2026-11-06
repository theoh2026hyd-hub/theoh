"use client";

import { RefreshCw, ArrowLeft, AlertTriangle, WifiOff, ServerCrash, Clock } from "lucide-react";

/**
 * ErrorState — Inline error state for sections/components that fail to load data.
 * Sits within the page layout (not full-page). Reusable across all data-fetching components.
 *
 * Props:
 *   title       — Error heading
 *   description — Friendly explanation
 *   onRetry     — Retry callback
 *   onGoBack    — Go back callback
 *   variant     — "api" | "network" | "timeout" | "generic" (controls icon)
 *   compact     — Smaller version for inline sections
 */

const VARIANT_ICONS = {
  api: ServerCrash,
  network: WifiOff,
  timeout: Clock,
  generic: AlertTriangle,
};

export default function ErrorState({
  title = "Unable to Load Content",
  description = "Something went wrong while loading the information.",
  onRetry,
  onGoBack,
  variant = "generic",
  compact = false,
}) {
  const IconComponent = VARIANT_ICONS[variant] || AlertTriangle;

  return (
    <div
      className={`error-state${compact ? " error-state--compact" : ""}`}
      role="alert"
      aria-live="polite"
    >
      <div className="error-state-icon" aria-hidden="true">
        <IconComponent size={compact ? 28 : 36} />
      </div>

      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-description">{description}</p>

      <div className="error-state-actions">
        {onRetry && (
          <button
            type="button"
            className="error-state-btn error-state-btn--primary"
            onClick={onRetry}
          >
            <RefreshCw size={14} aria-hidden="true" />
            <span>Retry</span>
          </button>
        )}
        {onGoBack && (
          <button
            type="button"
            className="error-state-btn error-state-btn--secondary"
            onClick={onGoBack}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Go Back</span>
          </button>
        )}
      </div>
    </div>
  );
}
