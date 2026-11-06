"use client";

import { Loader2 } from "lucide-react";

export default function LoadingButton({
  loading = false,
  loadingText,
  children,
  className = "",
  disabled = false,
  type = "button",
  spinnerSize = 14,
  ...props
}) {
  const label = loading && loadingText ? loadingText : children;

  return (
    <button
      type={type}
      className={`loading-btn${loading ? " is-loading" : ""}${className ? ` ${className}` : ""}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 size={spinnerSize} className="loading-btn-spinner" aria-hidden="true" /> : null}
      <span className="loading-btn-label">{label}</span>
    </button>
  );
}
