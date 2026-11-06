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

export function getDeliveryTimeSlots(settings = {}, { enabledOnly = true } = {}) {
  const slots = parseDeliveryTimeSlots(settings.delivery_time_slots, {
    openTime: settings.open_time,
    closeTime: settings.close_time
  });
  return enabledOnly ? slots.filter((slot) => isSlotEnabled(slot)) : slots;
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
