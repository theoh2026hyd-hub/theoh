/** Local calendar date as YYYY-MM-DD (matches HTML date input values). */
export function toLocalDateKey(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const ADMIN_TIMEZONE = "Asia/Kolkata";

/** Calendar date key (YYYY-MM-DD) in a specific IANA timezone. */
export function toDateKeyInTimezone(date = new Date(), timeZone = ADMIN_TIMEZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function getTodayDateKey(timeZone = ADMIN_TIMEZONE) {
  return toDateKeyInTimezone(new Date(), timeZone);
}

export function formatAdminDateLabel(dateKey, { timeZone = ADMIN_TIMEZONE } = {}) {
  if (!dateKey) return "";
  const d = new Date(`${dateKey}T12:00:00.000+05:30`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function formatAdminDateTime(isoString, { timeZone = ADMIN_TIMEZONE } = {}) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
