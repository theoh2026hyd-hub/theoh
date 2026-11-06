import { DEFAULT_SIZE_LABEL } from "./productSizes";

/** DB stores calories for Small; Medium +30, Large +45 */
export const SIZE_CALORIE_OFFSETS = {
  Small: 0,
  Medium: 30,
  Large: 45,
};

export function getSizeCalorieOffset(sizeLabel = DEFAULT_SIZE_LABEL) {
  const normalized = String(sizeLabel || DEFAULT_SIZE_LABEL).trim();
  if (Object.prototype.hasOwnProperty.call(SIZE_CALORIE_OFFSETS, normalized)) {
    return SIZE_CALORIE_OFFSETS[normalized];
  }
  const match = Object.entries(SIZE_CALORIE_OFFSETS).find(
    ([label]) => label.toLowerCase() === normalized.toLowerCase()
  );
  return match ? match[1] : 0;
}

export function getCaloriesForSize(baseCalories, sizeLabel = DEFAULT_SIZE_LABEL) {
  const base = parseFloat(baseCalories);
  if (!Number.isFinite(base)) return null;
  return Math.round(base + getSizeCalorieOffset(sizeLabel));
}

export function enrichSizesWithCalories(sizes = [], baseCalories) {
  return sizes.map((size) => ({
    ...size,
    calories: getCaloriesForSize(baseCalories, size.label),
  }));
}

export function formatCaloriesRange(baseCalories, sizes = []) {
  const values = enrichSizesWithCalories(sizes, baseCalories)
    .map((s) => s.calories)
    .filter((v) => v != null);

  if (values.length === 0) {
    const single = getCaloriesForSize(baseCalories, DEFAULT_SIZE_LABEL);
    return single != null ? `${single} kcal` : null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return `${min} kcal`;
  return `${min}–${max} kcal`;
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
