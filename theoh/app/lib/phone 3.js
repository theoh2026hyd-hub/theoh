export const PHONE_DIGIT_LENGTH = 10;

export function normalizePhoneDigits(phone) {
  return (phone || "").replace(/[^0-9]/g, "");
}

/** Keeps only digits and caps length for phone inputs. */
export function sanitizePhoneInput(value, maxLength = PHONE_DIGIT_LENGTH) {
  return normalizePhoneDigits(value).slice(0, maxLength);
}

/** Last 10 digits — used for consistent order/wallet lookups. */
export function getPhoneLast10(phone) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length <= PHONE_DIGIT_LENGTH) return digits;
  return digits.slice(-PHONE_DIGIT_LENGTH);
}

export function isValidPhone(phone) {
  return normalizePhoneDigits(phone).length === PHONE_DIGIT_LENGTH;
}

export function getStoredPhone() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("theoh_phone") || "";
}
