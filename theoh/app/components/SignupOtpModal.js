"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import LoadingButton from "./LoadingButton";
import { OTP_DIGIT_LENGTH, sanitizeOtpInput } from "../lib/otpInput";

export default function SignupOtpModal({
  open,
  email,
  loading = false,
  resendLoading = false,
  errorMsg = "",
  successMsg = "",
  onClose,
  onSubmit,
  onResend,
}) {
  const [digits, setDigits] = useState(Array(OTP_DIGIT_LENGTH).fill(""));
  const [focusedIndex, setFocusedIndex] = useState(null);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!open) {
      setDigits(Array(OTP_DIGIT_LENGTH).fill(""));
      setFocusedIndex(null);
      return;
    }

    const timer = window.setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const otpValue = digits.join("");

  const applyCode = (raw, startIndex = 0) => {
    const code = sanitizeOtpInput(raw);
    if (!code) return;

    setDigits((prev) => {
      const next = [...prev];
      if (code.length === 1) {
        next[startIndex] = code;
      } else {
        // Full OTP paste / Safari autofill into one field
        const fillFrom = code.length >= OTP_DIGIT_LENGTH ? 0 : startIndex;
        for (let i = 0; i < OTP_DIGIT_LENGTH; i += 1) {
          next[i] = i < fillFrom ? next[i] : "";
        }
        for (let i = 0; i < code.length && fillFrom + i < OTP_DIGIT_LENGTH; i += 1) {
          next[fillFrom + i] = code[i];
        }
      }
      return next;
    });

    const focusIndex =
      code.length === 1
        ? Math.min(startIndex + 1, OTP_DIGIT_LENGTH - 1)
        : Math.min(
            (code.length >= OTP_DIGIT_LENGTH ? 0 : startIndex) + code.length,
            OTP_DIGIT_LENGTH - 1
          );
    window.setTimeout(() => {
      inputRefs.current[Math.min(focusIndex, OTP_DIGIT_LENGTH - 1)]?.focus();
    }, 0);
  };

  const updateDigit = (index, value) => {
    const cleaned = sanitizeOtpInput(value);
    // Safari OTP autofill often dumps the whole code into the first box
    if (cleaned.length > 1) {
      applyCode(cleaned, 0);
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });
    if (cleaned && index < OTP_DIGIT_LENGTH - 1) {
      window.setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < OTP_DIGIT_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted =
      event.clipboardData?.getData("text") ||
      event.clipboardData?.getData("text/plain") ||
      "";
    applyCode(pasted, 0);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const code = sanitizeOtpInput(otpValue);
    if (code.length !== OTP_DIGIT_LENGTH || loading) return;
    onSubmit?.(code);
  };

  const handleResendClick = () => {
    if (loading || resendLoading) return;
    setDigits(Array(OTP_DIGIT_LENGTH).fill(""));
    setFocusedIndex(0);
    window.setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 0);
    onResend?.();
  };

  return (
    <div className="signup-otp-overlay" role="dialog" aria-modal="true" aria-labelledby="signup-otp-title">
      <button type="button" className="signup-otp-backdrop" onClick={onClose} aria-label="Close verification popup" />
      <div className="signup-otp-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="signup-otp-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h4 id="signup-otp-title">Verify Your Email</h4>
        <p className="signup-otp-subtitle">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to finish creating your account.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="signup-otp-boxes" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <div
                key={index}
                className={`signup-otp-cell${focusedIndex === index ? " is-focused" : ""}${digit ? " has-value" : ""}`}
              >
                <span className="signup-otp-digit" aria-hidden="true">
                  {digit}
                </span>
                <input
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  // Avoid maxLength={1}: Safari/Firefox paste/autofill truncate before JS runs.
                  className="signup-otp-input"
                  value={digit}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => setFocusedIndex((current) => (current === index ? null : current))}
                  disabled={loading}
                  aria-label={`Digit ${index + 1} of ${OTP_DIGIT_LENGTH}`}
                />
              </div>
            ))}
          </div>

          {errorMsg ? <p className="signup-otp-error">{errorMsg}</p> : null}
          {successMsg ? <p className="signup-otp-success">{successMsg}</p> : null}

          <LoadingButton
            type="submit"
            className="btn-primary signup-otp-submit"
            loading={loading}
            loadingText="Verifying…"
            disabled={otpValue.length !== OTP_DIGIT_LENGTH}
          >
            Verify &amp; Create Account
          </LoadingButton>
        </form>

        <div className="signup-otp-resend-row">
          <span>Didn&apos;t receive the code?</span>
          <button type="button" onClick={handleResendClick} disabled={loading || resendLoading}>
            {resendLoading ? "Sending…" : "Resend code"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .signup-otp-overlay {
          position: fixed;
          inset: 0;
          z-index: 12000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .signup-otp-backdrop {
          position: absolute;
          inset: 0;
          border: none;
          background: rgba(0, 0, 0, 0.55);
          cursor: pointer;
        }

        .signup-otp-panel {
          position: relative;
          z-index: 1;
          width: min(100%, 420px);
          background: #fff;
          border-radius: 16px;
          padding: 28px 24px 22px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .signup-otp-panel form {
          width: 100%;
          /* Avoid flex on <form> — Safari can reorder submit above OTP boxes. */
          display: block;
          text-align: center;
        }

        .signup-otp-close {
          position: absolute;
          top: 12px;
          right: 12px;
          border: none;
          background: transparent;
          color: #666;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }

        .signup-otp-panel h4 {
          margin: 0 0 8px;
          font-size: 22px;
          color: #111;
          width: 100%;
          text-align: center;
        }

        .signup-otp-subtitle {
          margin: 0 0 22px;
          font-size: 13px;
          line-height: 1.5;
          color: #666;
          width: 100%;
          text-align: center;
        }

        .signup-otp-subtitle strong {
          color: #111;
          word-break: break-word;
        }

        .signup-otp-boxes {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          width: 100%;
          max-width: 340px;
          margin: 0 auto 16px;
        }

        .signup-otp-cell {
          position: relative;
          flex: 0 0 44px;
          width: 44px;
          height: 48px;
          border: 1px solid rgba(0, 0, 0, 0.14);
          border-radius: 10px;
          background: #fafafa;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .signup-otp-cell.is-focused {
          border-color: rgba(1, 46, 2, 0.45);
          box-shadow: 0 0 0 3px rgba(1, 46, 2, 0.08);
          background: #fff;
        }

        .signup-otp-digit {
          font-size: 20px;
          font-weight: 700;
          color: #111;
          line-height: 1;
          pointer-events: none;
          user-select: none;
          text-align: center;
          width: 100%;
        }

        .signup-otp-input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          border: none;
          outline: none;
          background: transparent;
          color: transparent;
          caret-color: #111;
          text-align: center;
          font-size: 20px;
          font-weight: 700;
          box-shadow: none;
          -webkit-text-fill-color: transparent;
        }

        .signup-otp-input:disabled {
          cursor: not-allowed;
        }

        .signup-otp-error {
          margin: 0 0 12px;
          color: #dc2626;
          font-size: 13px;
          line-height: 1.45;
          width: 100%;
          text-align: center;
        }

        .signup-otp-success {
          margin: 0 0 12px;
          color: #15803d;
          font-size: 13px;
          line-height: 1.45;
          width: 100%;
          text-align: center;
        }

        .signup-otp-submit {
          width: 100%;
          max-width: 340px;
          justify-content: center;
          margin: 0 auto;
          display: inline-flex;
          -webkit-appearance: none;
          appearance: none;
          float: none;
        }

        .signup-otp-resend-row {
          margin-top: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
          align-items: center;
          width: 100%;
          font-size: 13px;
          color: #666;
          text-align: center;
        }

        .signup-otp-resend-row button {
          border: none;
          background: none;
          color: var(--primary-brand, #012e02);
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }

        .signup-otp-resend-row button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 480px) {
          .signup-otp-panel {
            padding: 24px 18px 18px;
          }

          .signup-otp-cell {
            flex-basis: 40px;
            width: 40px;
            height: 44px;
          }

          .signup-otp-digit,
          .signup-otp-input {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}
