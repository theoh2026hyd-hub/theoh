export const PHONE_DIGIT_LENGTH = 10;

export const PHONE_EXACT_LENGTH_ERROR =
  "Phone number must be exactly 10 digits. Extra digits are not allowed.";

export function normalizePhoneDigits(phone) {
  return (phone || "").replace(/[^0-9]/g, "");
}

/**
 * Input sanitizer: digits only, hard-capped at 10 (does not silently keep trailing extras).
 */
export function sanitizePhoneInput(value, maxLength = PHONE_DIGIT_LENGTH) {
  return normalizePhoneDigits(value).slice(0, maxLength);
}

/** Last 10 digits — used for order/wallet lookups when stored values may include a country code. */
export function getPhoneLast10(phone) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length <= PHONE_DIGIT_LENGTH) return digits;
  return digits.slice(-PHONE_DIGIT_LENGTH);
}

export function isValidPhone(phone) {
  return normalizePhoneDigits(phone).length === PHONE_DIGIT_LENGTH;
}

/**
 * Returns an error string for empty / short / long phone input, or "" when valid.
 */
export function getPhoneValidationError(phone) {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "Please enter your phone number.";
  if (digits.length > PHONE_DIGIT_LENGTH) return PHONE_EXACT_LENGTH_ERROR;
  if (digits.length < PHONE_DIGIT_LENGTH) {
    return `Enter a valid 10-digit phone number (${digits.length}/10).`;
  }
  return "";
}

/**
 * Apply typed/pasted phone text. Caps at 10 digits and flags overflow for UI errors.
 */
export function applyPhoneInputChange(nextRaw) {
  const digits = normalizePhoneDigits(nextRaw);
  if (digits.length > PHONE_DIGIT_LENGTH) {
    return {
      value: digits.slice(0, PHONE_DIGIT_LENGTH),
      error: PHONE_EXACT_LENGTH_ERROR,
      overflow: true,
    };
  }
  return {
    value: digits,
    error: "",
    overflow: false,
  };
}

export function getStoredPhone() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("theoh_phone") || "";
}
