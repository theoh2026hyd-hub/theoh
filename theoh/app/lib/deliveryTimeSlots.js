const SLOT_DURATION_MINUTES = 60;

export const DEFAULT_OPEN_TIME = "12:00";
export const DEFAULT_CLOSE_TIME = "23:00";

function isSlotEnabled(slot) {
  if (slot == null || typeof slot !== "object") return true;
  const value = slot.enabled;
  if (value === false || value === 0 || value === "false" || value === "0") return false;
  return true;
}

function parseTimeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const [hourPart, minutePart = "0"] = timeStr.trim().split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function formatMinutesTo12HourLabel(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minuteLabel = String(minutes).padStart(2, "0");
  return `${hour12}:${minuteLabel} ${period}`;
}

function formatSlotLabelFromMinutes(startMinutes, endMinutes) {
  return `${formatMinutesTo12HourLabel(startMinutes)} - ${formatMinutesTo12HourLabel(endMinutes)}`;
}

export function generateDeliveryTimeSlotsFromTimings(
  openTime = DEFAULT_OPEN_TIME,
  closeTime = DEFAULT_CLOSE_TIME
) {
  const openMinutes = parseTimeStringToMinutes(openTime);
  const closeMinutes = parseTimeStringToMinutes(closeTime);

  if (openMinutes == null || closeMinutes == null || closeMinutes <= openMinutes) {
    return [];
  }

  const slots = [];
  for (let start = openMinutes; start + SLOT_DURATION_MINUTES <= closeMinutes; start += SLOT_DURATION_MINUTES) {
    const end = start + SLOT_DURATION_MINUTES;
    slots.push({
      label: formatSlotLabelFromMinutes(start, end),
      startHour: Math.floor(start / 60),
      enabled: true
    });
  }

  return slots;
}

export const DEFAULT_DELIVERY_TIME_SLOTS = generateDeliveryTimeSlotsFromTimings(
  DEFAULT_OPEN_TIME,
  DEFAULT_CLOSE_TIME
);

function normalizeStoredSlots(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((slot) => ({
        label: String(slot.label || "").trim(),
        startHour: Number(slot.startHour),
        enabled: isSlotEnabled(slot)
      }))
      .filter((slot) => slot.label && !Number.isNaN(slot.startHour));
  } catch {
    return [];
  }
}

export function mergeSlotEnabledState(generatedSlots, storedSlots = []) {
  const enabledByStartHour = new Map();
  normalizeStoredSlots(storedSlots).forEach((slot) => {
    enabledByStartHour.set(slot.startHour, slot.enabled);
  });

  return generatedSlots.map((slot) => ({
    ...slot,
    enabled: enabledByStartHour.has(slot.startHour) ? enabledByStartHour.get(slot.startHour) : true
  }));
}

export function parseDeliveryTimeSlots(rawValue, { openTime, closeTime } = {}) {
  const generated = generateDeliveryTimeSlotsFromTimings(
    openTime || DEFAULT_OPEN_TIME,
    closeTime || DEFAULT_CLOSE_TIME
  );

  if (generated.length > 0) {
    const stored = normalizeStoredSlots(rawValue);
    return stored.length > 0 ? mergeSlotEnabledState(generated, stored) : generated;
  }

  const stored = normalizeStoredSlots(rawValue);
  return stored.length > 0 ? stored : [...DEFAULT_DELIVERY_TIME_SLOTS];
}

export function serializeDeliveryTimeSlots(slots) {
  return JSON.stringify(
    (Array.isArray(slots) ? slots : [])
      .map((slot) => ({
        label: String(slot.label || "").trim(),
        startHour: Number(slot.startHour),
        enabled: isSlotEnabled(slot)
      }))
      .filter((slot) => slot.label && !Number.isNaN(slot.startHour))
  );
}

function isYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function createRuleId() {
  return `slot_rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Date-specific slot rules stored in settings.delivery_time_slot_date_rules.
 * Each rule: { id, from, to, slots: [{ startHour, enabled }] }
 */
export function parseDeliveryTimeSlotDateRules(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.rules)
        ? parsed.rules
        : [];

    return list
      .map((rule) => {
        const from = String(rule?.from || rule?.date || "").trim();
        const to = String(rule?.to || rule?.from || rule?.date || "").trim();
        if (!isYmd(from) || !isYmd(to) || to < from) return null;

        const slotsRaw = Array.isArray(rule?.slots)
          ? rule.slots
          : rule?.slotMap && typeof rule.slotMap === "object"
            ? Object.entries(rule.slotMap).map(([startHour, enabled]) => ({ startHour, enabled }))
            : [];

        const slots = slotsRaw
          .map((slot) => ({
            startHour: Number(slot.startHour),
            enabled: isSlotEnabled(slot)
          }))
          .filter((slot) => !Number.isNaN(slot.startHour));

        if (slots.length === 0) return null;

        return {
          id: String(rule?.id || createRuleId()),
          from,
          to,
          slots
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function serializeDeliveryTimeSlotDateRules(rules) {
  return JSON.stringify(
    (Array.isArray(rules) ? rules : [])
      .map((rule) => {
        const from = String(rule?.from || "").trim();
        const to = String(rule?.to || rule?.from || "").trim();
        if (!isYmd(from) || !isYmd(to) || to < from) return null;

        const slots = (Array.isArray(rule?.slots) ? rule.slots : [])
          .map((slot) => ({
            startHour: Number(slot.startHour),
            enabled: isSlotEnabled(slot)
          }))
          .filter((slot) => !Number.isNaN(slot.startHour));

        if (slots.length === 0) return null;

        return {
          id: String(rule?.id || createRuleId()),
          from,
          to,
          slots
        };
      })
      .filter(Boolean)
  );
}

/** Enabled overrides for a calendar date (later matching rules win). */
export function getDateSlotOverrideMap(rules, deliveryDate) {
  if (!isYmd(deliveryDate)) return new Map();

  const map = new Map();
  parseDeliveryTimeSlotDateRules(rules).forEach((rule) => {
    if (deliveryDate < rule.from || deliveryDate > rule.to) return;
    rule.slots.forEach((slot) => {
      map.set(slot.startHour, slot.enabled);
    });
  });
  return map;
}

export function applyDateSlotOverrides(slots, rules, deliveryDate) {
  const overrides = getDateSlotOverrideMap(rules, deliveryDate);
  if (overrides.size === 0) return slots;

  return (Array.isArray(slots) ? slots : []).map((slot) => ({
    ...slot,
    enabled: overrides.has(slot.startHour) ? overrides.get(slot.startHour) : slot.enabled
  }));
}

export function getDeliveryTimeSlots(settings = {}, { enabledOnly = true } = {}) {
  const slots = parseDeliveryTimeSlots(settings.delivery_time_slots, {
    openTime: settings.open_time,
    closeTime: settings.close_time
  });
  return enabledOnly ? slots.filter((slot) => isSlotEnabled(slot)) : slots;
}

/**
 * Slots shown to customers for a selected date:
 * global defaults + date-specific overrides + same-day lead time.
 */
export function getAvailableTimeSlotsForDate(settings = {}, deliveryDate) {
  const baseSlots = parseDeliveryTimeSlots(settings.delivery_time_slots, {
    openTime: settings.open_time,
    closeTime: settings.close_time
  });
  const withDateRules = applyDateSlotOverrides(
    baseSlots,
    settings.delivery_time_slot_date_rules,
    deliveryDate
  );
  const enabled = withDateRules.filter((slot) => isSlotEnabled(slot));
  return filterAvailableTimeSlots(enabled, deliveryDate);
}

export function filterAvailableTimeSlots(slots, deliveryDate) {
  if (!deliveryDate) return slots;

  const today = new Date();
  const [year, month, day] = deliveryDate.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);

  if (selectedDate.toDateString() !== today.toDateString()) {
    return slots;
  }

  return slots.filter((slot) => slot.startHour >= today.getHours() + 2);
}

/** Local calendar YYYY-MM-DD (avoids UTC day-shift from toISOString). */
export function formatLocalDateYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Rolling order window: today through today+6 (7 selectable days).
 * Advances automatically each calendar day.
 */
export function getOrderDateBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    min: formatLocalDateYmd(start),
    max: formatLocalDateYmd(end),
  };
}

export function isOrderDateInRange(dateStr, now = new Date()) {
  if (!dateStr || typeof dateStr !== "string") return false;
  const { min, max } = getOrderDateBounds(now);
  return dateStr >= min && dateStr <= max;
}

export function formatSlotRuleDateLabel(rule) {
  if (!rule?.from) return "";
  if (!rule.to || rule.to === rule.from) return rule.from;
  return `${rule.from} → ${rule.to}`;
}
