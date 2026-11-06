import { SIZE_LABELS, DEFAULT_SIZE_LABEL } from "./productSizes";
import { getCaloriesForSize, getCartLineCalories } from "./productCalories";

/** Default serving grams when admin has not configured per-size portions (oats S/M/L) */
export const DEFAULT_SIZE_GRAMS = [120, 180, 210];

/** Parse configured portion grams. Empty config → no invented grams. */
export function parseSizeGrams(sizeGramsRaw) {
  if (!sizeGramsRaw || !String(sizeGramsRaw).trim()) {
    return [];
  }

  const values = String(sizeGramsRaw)
    .split(",")
    .map((part) => parseInt(part.trim(), 10))
    .filter((num) => Number.isFinite(num) && num > 0);

  if (values.length === 0) {
    return [];
  }

  if (values.length === 2) {
    const step = values[1] - values[0];
    if (step > 0) values.push(values[1] + step);
  }

  return values.slice(0, SIZE_LABELS.length).map((grams, index) => ({
    label: SIZE_LABELS[index] || `Size ${index + 1}`,
    grams
  }));
}

export function getGramsForSize(sizeGramsRaw, sizeLabel = DEFAULT_SIZE_LABEL) {
  const portions = parseSizeGrams(sizeGramsRaw);
  if (portions.length === 0) return null;
  const match =
    portions.find((entry) => entry.label === sizeLabel) ||
    portions.find((entry) => entry.label.toLowerCase() === String(sizeLabel).toLowerCase()) ||
    portions[0];
  return match?.grams ?? null;
}

export function enrichSizesWithPortions(sizes = [], baseCalories, sizeGramsRaw) {
  const gramPortions = parseSizeGrams(sizeGramsRaw);
  const hasConfiguredGrams = gramPortions.length > 0;

  return sizes.map((size, index) => {
    const gramsEntry =
      gramPortions.find((entry) => entry.label === size.label) || gramPortions[index];
    return {
      ...size,
      grams: hasConfiguredGrams
        ? gramsEntry?.grams ?? null
        : size.grams ?? null,
      // Prefer calories already set by enrichSizesWithCalories (comma-separated).
      calories: size.calories ?? getCaloriesForSize(baseCalories, size.label, "")
    };
  });
}

export function formatSizePortionLabel(sizeOption) {
  const parts = [`₹${Number(sizeOption.price).toFixed(0)}`];
  if (sizeOption.grams != null && Number(sizeOption.grams) > 0) {
    parts.push(`${sizeOption.grams}g`);
  }
  if (sizeOption.calories != null && Number(sizeOption.calories) > 0) {
    parts.push(`${sizeOption.calories} kcal`);
  }
  return parts.join(" · ");
}

export function formatGramsRange(sizeGramsRaw, sizes = []) {
  const enriched =
    sizes.length > 0
      ? sizes
      : parseSizeGrams(sizeGramsRaw).map((entry) => ({ label: entry.label, grams: entry.grams }));

  const values = enriched.map((size) => size.grams).filter((v) => v != null && Number(v) > 0);
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return `${min}g`;
  return `${min}–${max}g`;
}

export function normalizeSizeGramsInput(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().replace(/[^\d]/g, ""))
    .filter(Boolean)
    .join(",");
}

export function sanitizeSizeGramsInput(value) {
  return String(value || "")
    .replace(/[^\d.,\s]/g, "")
    .replace(/\s+/g, "");
}

export function resolveCartLinePortionGrams(item) {
  if (!item) return null;
  const sizeLabel = item.sizeLabel || DEFAULT_SIZE_LABEL;

  if (item.portionGrams != null) {
    const parsed = parseInt(item.portionGrams, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  if (Array.isArray(item.sizes)) {
    const matched = item.sizes.find((size) => size.label === sizeLabel);
    if (matched?.grams != null) return parseInt(matched.grams, 10);
  }

  return getGramsForSize(item.sizeGramsRaw, sizeLabel);
}

export function getCartLinePortionDetails(item) {
  const qty = parseInt(item?.quantity, 10) || 1;
  const gramsPerUnit = resolveCartLinePortionGrams(item);
  const caloriesPerUnit = getCartLineCalories(item);

  return {
    qty,
    gramsPerUnit,
    totalGrams: gramsPerUnit != null ? gramsPerUnit * qty : null,
    caloriesPerUnit,
    totalCalories: caloriesPerUnit != null ? caloriesPerUnit * qty : null
  };
}

/** Price · grams · kcal for a single unit (menu card cart row). */
export function formatCartLinePortionInline(item, { includePrice = true } = {}) {
  const { gramsPerUnit, caloriesPerUnit } = getCartLinePortionDetails(item);
  const parts = [];
  if (includePrice) parts.push(`₹${Number(item.price || 0).toFixed(0)}`);
  if (gramsPerUnit != null) parts.push(`${gramsPerUnit}g`);
  if (caloriesPerUnit != null) parts.push(`${caloriesPerUnit} kcal`);
  return parts.join(" · ");
}

/** Quantity · grams · kcal for cart/checkout rows. */
export function formatCartLinePortionWithQty(item) {
  const { qty, gramsPerUnit, totalGrams, caloriesPerUnit, totalCalories } =
    getCartLinePortionDetails(item);
  const parts = [`Qty ${qty}`];
  if (gramsPerUnit != null) {
    parts.push(qty > 1 ? `${totalGrams}g total (${gramsPerUnit}g each)` : `${gramsPerUnit}g`);
  }
  if (caloriesPerUnit != null) {
    parts.push(
      qty > 1 ? `${totalCalories} kcal total (${caloriesPerUnit} each)` : `${caloriesPerUnit} kcal`
    );
  }
  return parts.join(" · ");
}
