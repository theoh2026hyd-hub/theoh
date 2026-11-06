import { SIZE_LABELS, DEFAULT_SIZE_LABEL } from "./productSizes";

/**
 * Parse comma-separated calories for Small, Medium, Large.
 * No +30/+45 offsets — each size uses the value provided (or the single base for all).
 */
export function parseSizeCalories(sizeCaloriesRaw, baseCalories) {
  const values = String(sizeCaloriesRaw || "")
    .split(",")
    .map((part) => parseFloat(part.trim()))
    .filter((num) => Number.isFinite(num) && num > 0);

  if (values.length === 0) {
    const base = parseFloat(baseCalories);
    if (!Number.isFinite(base) || base <= 0) return [];
    const rounded = Math.round(base);
    return SIZE_LABELS.map((label) => ({ label, calories: rounded }));
  }

  const padded = [...values];
  while (padded.length < SIZE_LABELS.length) {
    padded.push(padded[padded.length - 1]);
  }

  return padded.slice(0, SIZE_LABELS.length).map((calories, index) => ({
    label: SIZE_LABELS[index] || `Size ${index + 1}`,
    calories: Math.round(calories),
  }));
}

export function getCaloriesForSize(
  baseCalories,
  sizeLabel = DEFAULT_SIZE_LABEL,
  sizeCaloriesRaw = ""
) {
  const portions = parseSizeCalories(sizeCaloriesRaw, baseCalories);
  if (portions.length === 0) {
    const base = parseFloat(baseCalories);
    return Number.isFinite(base) && base > 0 ? Math.round(base) : null;
  }

  const normalized = String(sizeLabel || DEFAULT_SIZE_LABEL).trim();
  const match =
    portions.find((entry) => entry.label === normalized) ||
    portions.find((entry) => entry.label.toLowerCase() === normalized.toLowerCase()) ||
    portions[0];
  return match?.calories ?? null;
}

export function enrichSizesWithCalories(sizes = [], baseCalories, sizeCaloriesRaw = "") {
  const caloriePortions = parseSizeCalories(sizeCaloriesRaw, baseCalories);
  return sizes.map((size, index) => {
    const entry =
      caloriePortions.find((portion) => portion.label === size.label) ||
      caloriePortions[index];
    const fallback = parseFloat(baseCalories);
    return {
      ...size,
      calories:
        entry?.calories ??
        (Number.isFinite(fallback) && fallback > 0
          ? Math.round(fallback)
          : size.calories ?? null),
    };
  });
}

export function formatCaloriesRange(baseCalories, sizes = [], sizeCaloriesRaw = "") {
  const enriched = enrichSizesWithCalories(
    sizes.length
      ? sizes
      : SIZE_LABELS.map((label) => ({ label })),
    baseCalories,
    sizeCaloriesRaw
  );
  const values = enriched.map((s) => s.calories).filter((v) => v != null && Number(v) > 0);

  if (values.length === 0) {
    const single = getCaloriesForSize(baseCalories, DEFAULT_SIZE_LABEL, sizeCaloriesRaw);
    return single != null ? `${single} kcal` : null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return `${min} kcal`;
  return `${min}–${max} kcal`;
}

export function normalizeSizeCaloriesInput(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().replace(/[^\d.]/g, ""))
    .filter(Boolean)
    .join(",");
}

export function sanitizeSizeCaloriesInput(value) {
  return String(value || "")
    .replace(/[^\d.,\s]/g, "")
    .replace(/\s+/g, "");
}

/** First calorie value — stored on products.calories for compatibility. */
export function firstSizeCalorie(sizeCaloriesRaw, fallback = null) {
  const portions = parseSizeCalories(sizeCaloriesRaw, fallback);
  return portions[0]?.calories ?? (Number.isFinite(parseFloat(fallback)) ? Math.round(parseFloat(fallback)) : null);
}

/** Estimated grams per add-on topping when showing cart calories */
export const ADDON_PORTION_GRAMS = 30;

export function getAddonServingCalories(addon) {
  const per100 = parseFloat(addon?.calories);
  if (!Number.isFinite(per100)) return 0;
  const grams = parseInt(addon?.grams, 10);
  const portion = Number.isFinite(grams) && grams > 0 ? grams : ADDON_PORTION_GRAMS;
  const qty = parseInt(addon?.quantity, 10);
  const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
  return Math.round((per100 / 100) * portion) * quantity;
}

export function getCartLineCalories(item) {
  const base =
    item?.calories != null && Number.isFinite(parseFloat(item.calories))
      ? Math.round(parseFloat(item.calories))
      : null;
  const addonCalories = (item?.selectedAddons || []).reduce(
    (sum, addon) => sum + getAddonServingCalories(addon),
    0
  );
  if (base == null && addonCalories === 0) return null;
  return (base || 0) + addonCalories;
}
