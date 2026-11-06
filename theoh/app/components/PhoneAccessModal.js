"use client";

import { useState, useEffect } from "react";
import { X, Phone, ShieldCheck } from "lucide-react";
import {
  applyPhoneInputChange,
  getPhoneValidationError,
  isValidPhone,
  sanitizePhoneInput,
} from "../lib/phone";
import { parseJsonResponse } from "../lib/fetchJson";

export default function PhoneAccessModal({ isOpen, onClose, onVerified, initialPhone = "" }) {
  const [phoneInput, setPhoneInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPhoneInput(sanitizePhoneInput(initialPhone || ""));
      setErrorMsg("");
    }
  }, [isOpen, initialPhone]);

  const updatePhone = (raw) => {
    const { value, error, overflow } = applyPhoneInputChange(raw);
    setPhoneInput(value);
    if (overflow) {
      setErrorMsg(error);
    } else if (errorMsg === "Phone number must be exactly 10 digits. Extra digits are not allowed.") {
      setErrorMsg("");
    }
  };

  const handleAccessSuite = async () => {
    const trimmed = sanitizePhoneInput(phoneInput);
    const validationError = getPhoneValidationError(trimmed);
    if (validationError || !isValidPhone(trimmed)) {
      setErrorMsg(validationError || "Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/user?phone=${encodeURIComponent(trimmed)}`);
      const data = await parseJsonResponse(res);

      if (!data.success) {
        setErrorMsg(data.error || "Could not verify your number. Please try again.");
        return;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("theoh_phone", trimmed);
      }

      onVerified(trimmed, data);
    } catch {
      setErrorMsg("Connection failure while verifying your number.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="phone-access-overlay" onClick={onClose}>
      <div className="phone-access-panel glass-effect" onClick={(e) => e.stopPropagation()}>
        <div className="phone-access-header">
          <h3>
            <Phone size={20} /> Your Phone Number
          </h3>
          <button type="button" className="phone-access-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <p className="phone-access-hint">
          Enter your 10-digit mobile number to link loyalty coins, order history, and rewards.
        </p>

        <div className="phone-access-form">
          <input
            type="tel"
            className="phone-access-input"
            placeholder="9876543210"
            value={phoneInput}
            onChange={(e) => updatePhone(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              updatePhone(e.clipboardData.getData("text"));
            }}
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            onKeyDown={(e) => {
              if (/^\d$/.test(e.key) && phoneInput.length >= 10 && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setErrorMsg("Phone number must be exactly 10 digits. Extra digits are not allowed.");
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                handleAccessSuite();
              }
            }}
            autoFocus
          />
          <button
            type="button"
            className="btn-primary phone-access-btn"
            onClick={handleAccessSuite}
            disabled={loading}
          >
            <ShieldCheck size={16} />
            {loading ? "Verifying…" : "Continue"}
          </button>
        </div>

        {errorMsg && <p className="phone-access-error">{errorMsg}</p>}
      </div>
    </div>
  );
}
