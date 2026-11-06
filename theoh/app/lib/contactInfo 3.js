export const CONTACT_PHONE_DIAL = "+918247036103";
export const CONTACT_EMAIL = "theoh2026hyd@gmail.com";
export const CONTACT_LOCATION = "Hyderabad, Telangana, India";
export const CONTACT_LOCATION_MAP_LINK = "https://maps.app.goo.gl/YzAWGfhBK3qabsZP8";
export const CONTACT_INSTAGRAM_URL = "https://www.instagram.com/theoh.hyd";

/** True when admin address looks like raw lat/lng instead of a place name. */
export function looksLikeCoordinateAddress(value) {
  if (!value || typeof value !== "string") return false;
  const s = value.trim();
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s)) return true;
  if (/^\d+\.\d+\s*,\s*\d+\.\d+$/.test(s)) return true;
  if (/\d+\.\d+°?\s*[NS]?\s*,?\s*\d+\.\d+°?\s*[EW]?/i.test(s)) return true;
  return false;
}

/** Human-readable city label for public contact (never raw coordinates). */
export function getPublicContactLocationLabel(settings) {
  const addr = settings?.restaurant_address?.trim();
  if (addr && !looksLikeCoordinateAddress(addr)) return addr;
  return CONTACT_LOCATION;
}

/** City-level Google Maps link for public contact (not kitchen pinpoint). */
export function getPublicContactMapLink() {
  return CONTACT_LOCATION_MAP_LINK;
}

export function getGmailComposeHref(email = CONTACT_EMAIL) {
  const to = encodeURIComponent(String(email || CONTACT_EMAIL).trim());
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}`;
}

export function getPhoneDialHref(phone) {
  const raw = String(phone || CONTACT_PHONE_DIAL).replace(/[\s()-]/g, "");
  if (raw.startsWith("+")) return `tel:${raw}`;
  if (raw.length === 10) return `tel:+91${raw}`;
  return `tel:+${raw.replace(/^\+?/, "")}`;
}
