"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import LoadingButton from "./LoadingButton";
import { parseJsonResponse } from "@/app/lib/fetchJson";
import {
  applyPhoneInputChange,
  getPhoneValidationError,
  isValidPhone,
  sanitizePhoneInput,
  PHONE_EXACT_LENGTH_ERROR,
} from "@/app/lib/phone";

export default function PhoneRequiredModal({ isOpen, onComplete }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const updatePhone = (raw) => {
    const { value, error, overflow } = applyPhoneInputChange(raw);
    setPhone(value);
    if (overflow) {
      setErrorMsg(error);
    } else if (errorMsg === PHONE_EXACT_LENGTH_ERROR) {
      setErrorMsg("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setErrorMsg("");
    const digits = sanitizePhoneInput(phone);
    const validationError = getPhoneValidationError(digits);
    if (validationError || !isValidPhone(digits)) {
      setErrorMsg(validationError || "Enter a valid 10-digit phone number.");
      return;
    }

    const phoneToSave = digits;
    setLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneToSave }),
      });
      const data = await parseJsonResponse(res);
      if (!data.success) {
        throw new Error(data.error || "Failed to save phone number.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("theoh_phone", phoneToSave);
      }
      onComplete?.(phoneToSave, data);
    } catch (err) {
      setErrorMsg(err.message || "Failed to save phone number.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-required-overlay" role="dialog" aria-modal="true" aria-labelledby="phone-required-title">
      <div className="phone-required-panel">
        <div className="phone-required-icon" aria-hidden="true">
          <Phone size={24} />
        </div>
        <h3 id="phone-required-title">Add your phone number</h3>
        <p className="phone-required-subtitle">
          We need your mobile number for order updates and delivery coordination.
        </p>

        <form onSubmit={handleSubmit} className="phone-required-form" noValidate>
          <label htmlFor="phone-required-input" className="phone-required-label">
            Phone number
          </label>
          <input
            id="phone-required-input"
            type="tel"
            className="phone-required-input"
            placeholder="9876543210"
            value={phone}
            onChange={(event) => updatePhone(event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              updatePhone(event.clipboardData.getData("text"));
            }}
            onKeyDown={(event) => {
              if (/^\d$/.test(event.key) && phone.length >= 10 && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                setErrorMsg(PHONE_EXACT_LENGTH_ERROR);
              }
            }}
            disabled={loading}
            autoFocus
            required
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
          />
          {errorMsg && <p className="phone-required-error">{errorMsg}</p>}
          <LoadingButton
            type="submit"
            className="btn-primary phone-required-submit"
            loading={loading}
            loadingText="Saving…"
          >
            Continue
          </LoadingButton>
        </form>
      </div>

      <style jsx>{`
        .phone-required-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 11, 9, 0.78);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 11000;
        }

        .phone-required-panel {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border-radius: 18px;
          padding: 28px 24px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
          text-align: center;
        }

        .phone-required-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 14px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(1, 46, 2, 0.08);
          color: var(--primary-brand, #012e02);
        }

        .phone-required-panel h3 {
          margin: 0 0 8px;
          font-size: 22px;
          color: #111;
        }

        .phone-required-subtitle {
          margin: 0 0 20px;
          font-size: 14px;
          line-height: 1.5;
          color: #666;
        }

        .phone-required-form {
          display: block;
          text-align: left;
          width: 100%;
        }

        .phone-required-label {
          display: block;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #666;
        }

        .phone-required-input {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px;
          padding: 0 14px;
          font-size: 15px;
          margin-bottom: 12px;
          box-sizing: border-box;
          -webkit-appearance: none;
          appearance: none;
        }

        .phone-required-error {
          color: #dc2626;
          font-size: 13px;
          margin: 0 0 12px;
        }

        .phone-required-submit {
          width: 100%;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
