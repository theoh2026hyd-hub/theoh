"use client";

import { X } from "lucide-react";

export default function FormModalCloseButton({
  onClick,
  variant = "dark",
  className = "",
  label = "Close",
}) {
  return (
    <button
      type="button"
      className={`form-modal-close-btn form-modal-close-btn--${variant} ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
    >
      <X size={18} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
