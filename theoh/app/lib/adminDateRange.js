import {
  toDateKeyInTimezone,
  getTodayDateKey,
  formatAdminDateLabel,
  ADMIN_TIMEZONE
} from "./dates";

export const ADMIN_DATE_RANGE_SECTIONS = new Set([
  "dashboard",
  "orders",
  "customers",
  "payments",
  "coins"
]);

export const DEFAULT_SECTION_DATE_RANGE = {
  preset: "today",
  from: "",
  to: ""
};

export function createDefaultSectionDateRanges() {
  return {
    dashboard: { ...DEFAULT_SECTION_DATE_RANGE },
    orders: { ...DEFAULT_SECTION_DATE_RANGE },
    customers: { ...DEFAULT_SECTION_DATE_RANGE },
    payments: { ...DEFAULT_SECTION_DATE_RANGE },
    coins: { ...DEFAULT_SECTION_DATE_RANGE }
  };
}

export function resolveDateRangeBounds(range = DEFAULT_SECTION_DATE_RANGE) {
  const preset = range?.preset || "today";
  if (preset === "all") {
    return { from: null, to: null, preset };
  }

  const now = new Date();
  const todayKey = getTodayDateKey(ADMIN_TIMEZONE);

  if (preset === "today") {
    return { from: todayKey, to: todayKey, preset };
  }

  if (preset === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return {
      from: toDateKeyInTimezone(weekAgo, ADMIN_TIMEZONE),
      to: todayKey,
      preset
    };
  }

  if (preset === "month") {
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 29);
    return {
      from: toDateKeyInTimezone(monthAgo, ADMIN_TIMEZONE),
      to: todayKey,
      preset
    };
  }

  if (preset === "custom") {
    const from = String(range?.from || "").trim();
    const to = String(range?.to || "").trim();
    if (!from || !to) {
      return { from: null, to: null, preset };
    }
    return { from, to: to >= from ? to : from, preset };
  }

  return { from: null, to: null, preset };
}

export const ADMIN_TIMEZONE_OFFSET = "+05:30";

export function getQueryTimestampBounds(bounds) {
  if (!bounds?.from || !bounds?.to) return null;
  return {
    from: `${bounds.from}T00:00:00.000${ADMIN_TIMEZONE_OFFSET}`,
    to: `${bounds.to}T23:59:59.999${ADMIN_TIMEZONE_OFFSET}`
  };
}

export function appendDateRangeSearchParams(params, range) {
  const bounds = resolveDateRangeBounds(range);
  if (bounds.from) params.set("dateFrom", bounds.from);
  if (bounds.to) params.set("dateTo", bounds.to);
  return bounds;
}

export function isValidDateRangeInput(range) {
  return Boolean(
    range &&
      typeof range === "object" &&
      typeof range.preset === "string"
  );
}

export function getDateRangeLabel(range, stats) {
  if (stats?.dateRange?.label) {
    const { from, to, label } = stats.dateRange;
    if (from && to && from === to) {
      return formatAdminDateLabel(from);
    }
    if (from && to) {
      return `${formatAdminDateLabel(from)} → ${formatAdminDateLabel(to)}`;
    }
    return label;
  }

  const bounds = resolveDateRangeBounds(range);
  const preset = range?.preset || bounds.preset || "today";

  if (preset === "all" || !bounds.from) {
    return "All Time";
  }

  if (bounds.from === bounds.to) {
    return formatAdminDateLabel(bounds.from);
  }

  return `${formatAdminDateLabel(bounds.from)} → ${formatAdminDateLabel(bounds.to)}`;
}
