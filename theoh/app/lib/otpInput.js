/** Shared OTP input helpers — Safari/Firefox-safe paste & autofill. */

export const OTP_DIGIT_LENGTH = 6;

/** Extract up to 6 digits from typed/pasted/autofilled text. */
export function sanitizeOtpInput(value, maxLength = OTP_DIGIT_LENGTH) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

/**
 * Paste handler for a single OTP field.
 * Call with preventDefault so maxLength does not truncate before digit extraction.
 */
export function otpFromClipboardEvent(event, maxLength = OTP_DIGIT_LENGTH) {
  const text =
    event?.clipboardData?.getData?.("text") ||
    event?.clipboardData?.getData?.("text/plain") ||
    "";
  return sanitizeOtpInput(text, maxLength);
}
