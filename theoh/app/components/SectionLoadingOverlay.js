"use client";

export default function SectionLoadingOverlay({ loading = false, variant = "light", label = "Loading section" }) {
  if (!loading) return null;

  return (
    <div
      className={`section-loading-overlay section-loading-overlay--${variant}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className={`loading-spinner-luxury section-loading-spinner${variant === "dark" ? " section-loading-spinner--dark" : ""}`}
        aria-hidden="true"
      />
    </div>
  );
}
