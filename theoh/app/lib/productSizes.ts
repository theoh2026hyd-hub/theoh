export const SIZE_LABELS: string[] = ["Small", "Medium", "Large"];

export const DEFAULT_SIZE_LABEL: string = "Small";

/** Cookies / Bread & Butter / single-price items — hide Small/Medium/Large labels. */
export function shouldHideSizeQuantityLabel(item: any): boolean {
  // Customize bowls always show Medium + Large chooser labels.
  if (isCustomizeBowlItem(item)) return false;
  if (isCookiesCategory(item) || isBreadsCategory(item)) return true;
  if (item?.hideSizeLabel) return true;
  const sizes = Array.isArray(item?.sizes) ? item.sizes : null;
  // Cart lines often omit sizes — don't force-hide their stored sizeLabel.
  if (!sizes) return false;
  if (sizes.length <= 1) return true;
  if (filterPricedSizes(sizes).length <= 1) return true;
  return false;
}

export function isBreadsCategory(itemOrName: any): boolean {
  if (itemOrName && typeof itemOrName === "object") {
    const category = String(itemOrName.category || "").trim().toLowerCase();
    const categoryRaw = String(itemOrName.categoryRaw || "").trim().toLowerCase();
    return (
      category === "breads" ||
      category === "bread" ||
      category === "bread & butter" ||
      categoryRaw === "breads" ||
      categoryRaw === "bread" ||
      categoryRaw === "bread & butter"
    );
  }
  const value = String(itemOrName || "").trim().toLowerCase();
  return value === "breads" || value === "bread" || value === "bread & butter";
}

function isBananaItemName(name: string | any): boolean {
  return /^bananas?$/i.test(String(name || "").trim());
}

export function isCookiesCategory(itemOrName: any): boolean {
  if (itemOrName && typeof itemOrName === "object") {
    const category = String(itemOrName.category || "").trim().toLowerCase();
    const categoryRaw = String(itemOrName.categoryRaw || "").trim().toLowerCase();
    return (
      category === "cookies" ||
      categoryRaw === "cookies" ||
      category.includes("cookie") ||
      categoryRaw.includes("cookie")
    );
  }
  const value = String(itemOrName || "").trim().toLowerCase();
  return value === "cookies" || value.includes("cookie");
}

/** Selling unit label for single-serve items (shown in price + description). */
export function getProductUnitLabel(item: any): string | null {
  if (isBreadsCategory(item)) return "slice";
  if (isBananaItemName(item?.name)) return "slice";
  return null;
}

/** Unit label for add-on toppings that are sold per slice. */
export function getAddonUnitLabel(addon) {
  if (isBananaItemName(addon?.name)) return "slice";
  return null;
}

/** Ensure bread / banana descriptions clearly say pricing is per slice. */
export function formatProductDescription(item, description = null) {
  const text = String(description ?? item?.description ?? "").trim();
  const unit = getProductUnitLabel(item);
  if (!unit) return text;

  const perUnitPattern = new RegExp(`per\\s+${unit}`, "i");
  if (perUnitPattern.test(text)) return text;
  if (!text) return `Priced per ${unit}.`;
  return `${text.replace(/\s+$/, "")} Priced per ${unit}.`;
}

export const COOKIE_NUTRITION_DEFAULTS = {
  serving_size: "",
  serving_weight_g: "",
  total_weight_g: "",
  saturated_fat: "",
  sugar: "",
  dietary_fibre: "",
  sodium_mg: "",
};

export function stripSizePricesFromDescription(description = "") {
  if (!description) return "";
  let result = description.split(" || size_prices:")[0].trim();
  if (result.includes(" || size_grams:")) {
    result = result.split(" || size_grams:")[0].trim();
  }
  return result;
}

export function stripSizeGramsFromDescription(description = "") {
  if (!description) return description;
  return String(description).replace(/\s*\|\|\s*size_grams:[^|]+/i, "").trim();
}

export function extractSizePricesRaw(description = "") {
  if (!description || !description.includes(" || size_prices:")) return "";
  const tail = description.split(" || size_prices:")[1] || "";
  return tail
    .split(" || sub_category:")[0]
    .split(" || size_grams:")[0]
    .split(" || size_calories:")[0]
    .trim();
}

export function extractSizeGramsRaw(description = "") {
  if (!description || !description.includes(" || size_grams:")) return "";
  const tail = description.split(" || size_grams:")[1] || "";
  return tail.split(" || size_calories:")[0].split(" || sub_category:")[0].trim();
}

export function extractSizeCaloriesRaw(description = "") {
  if (!description || !/ \|\| size_calories:/i.test(description)) return "";
  const match = String(description).match(/\s*\|\|\s*size_calories:([^|]+)/i);
  return match ? match[1].trim() : "";
}

export function parseDescriptionParts(description = "") {
  let cleanDescription = String(description || "").trim();
  let subCategory = "regular";
  let sizePricesRaw = "";
  let sizeGramsRaw = "";
  let sizeCaloriesRaw = "";

  const caloriesMatch = cleanDescription.match(/\s*\|\|\s*size_calories:([^|]+)/i);
  if (caloriesMatch) {
    sizeCaloriesRaw = caloriesMatch[1].trim();
    cleanDescription = cleanDescription.replace(/\s*\|\|\s*size_calories:[^|]+/i, "").trim();
  }

  const gramsMatch = cleanDescription.match(/\s*\|\|\s*size_grams:([^|]+)/i);
  if (gramsMatch) {
    sizeGramsRaw = gramsMatch[1].trim();
    cleanDescription = cleanDescription.replace(/\s*\|\|\s*size_grams:[^|]+/i, "").trim();
  }

  const sizeMatch = cleanDescription.match(/\s*\|\|\s*size_prices:([^|]+)/i);
  if (sizeMatch) {
    sizePricesRaw = sizeMatch[1].trim();
    cleanDescription = cleanDescription.replace(/\s*\|\|\s*size_prices:[^|]+/i, "").trim();
  }

  const subMatch = cleanDescription.match(/\s*\|\|\s*sub_category:([^|]+)/i);
  if (subMatch) {
    subCategory = subMatch[1].trim();
    cleanDescription = cleanDescription.replace(/\s*\|\|\s*sub_category:[^|]+/i, "").trim();
  }

  return { cleanDescription, subCategory, sizePricesRaw, sizeGramsRaw, sizeCaloriesRaw };
}

export function buildDescriptionWithMeta(
  description,
  subCategory,
  sizePricesRaw,
  sizeGramsRaw,
  sizeCaloriesRaw
) {
  let result = String(description || "")
    .replace(/\s*\|\|\s*size_calories:[^|]+/gi, "")
    .replace(/\s*\|\|\s*size_grams:[^|]+/gi, "")
    .replace(/\s*\|\|\s*size_prices:[^|]+/gi, "")
    .replace(/\s*\|\|\s*sub_category:[^|]+/gi, "")
    .trim();

  if (subCategory && subCategory !== "regular") {
    result = `${result} || sub_category:${subCategory}`;
  }
  if (sizePricesRaw && String(sizePricesRaw).trim()) {
    result = `${result} || size_prices:${String(sizePricesRaw).trim()}`;
  }
  if (sizeGramsRaw && String(sizeGramsRaw).trim()) {
    result = `${result} || size_grams:${String(sizeGramsRaw).trim()}`;
  }
  if (sizeCaloriesRaw && String(sizeCaloriesRaw).trim()) {
    result = `${result} || size_calories:${String(sizeCaloriesRaw).trim()}`;
  }
  return result;
}

export function parseSizePrices(sizePricesRaw, fallbackPrice) {
  // Only use explicitly configured size prices — never invent defaults from fallback.
  if (!sizePricesRaw || !String(sizePricesRaw).trim()) {
    return [];
  }

  // Preserve slot positions so "90,0,150" → Small + Large (not Small + Medium).
  const parts = String(sizePricesRaw).split(",");
  const sizes = [];
  for (let index = 0; index < SIZE_LABELS.length; index += 1) {
    if (index >= parts.length) break;
    const raw = String(parts[index] ?? "").trim();
    if (!raw) continue;
    const price = parseFloat(raw);
    if (!Number.isFinite(price) || price < 1) continue;
    sizes.push({
      label: SIZE_LABELS[index],
      price,
    });
  }

  if (sizes.length === 0) return [];

  // Single priced slot → don't present as a multi-size S/M/L chooser.
  if (sizes.length === 1) {
    return [{ ...sizes[0], hideSizeLabel: true }];
  }

  return sizes;
}

/** First sellable price from comma-separated size prices, or 0 when none. */
export function firstSizePrice(sizePricesRaw, fallbackPrice = null) {
  const sizes = parseSizePrices(sizePricesRaw, fallbackPrice);
  if (sizes[0]?.price != null) return Number(sizes[0].price);
  return 0;
}

export function normalizeSizePricesInput(value) {
  // Keep empty slots so "90,,150" stays mapped to Small + Large.
  return String(value || "")
    .split(",")
    .map((part) => part.trim().replace(/[^\d.]/g, ""))
    .join(",")
    .replace(/,+$/g, "");
}

/** Allow comma-separated digits while typing (do not strip trailing commas). */
export function sanitizeSizePricesInput(value) {
  return String(value || "")
    .replace(/[^\d.,\s]/g, "")
    .replace(/\s+/g, "");
}

/** Sizes with a sellable price (₹1 or more). Zero/empty slots are hidden. */
export function filterPricedSizes(sizes = []) {
  return (Array.isArray(sizes) ? sizes : []).filter((size) => {
    const price = Number(size?.price);
    return Number.isFinite(price) && price >= 1;
  });
}

/** Admin / list display: only show prices that are >= 1, with size labels when useful. */
export function formatVisibleSizePrices(sizePricesRaw, sizes = [], fallbackPrice = null) {
  const pricedFromSizes = filterPricedSizes(sizes);
  if (pricedFromSizes.length > 0) {
    if (pricedFromSizes.length === 1 && pricedFromSizes[0].hideSizeLabel) {
      return String(pricedFromSizes[0].price);
    }
    const short = { Small: "S", Medium: "M", Large: "L" };
    return pricedFromSizes
      .map((s) => {
        const tag = short[s.label] || s.label;
        return pricedFromSizes.length > 1 ? `${tag}: ${s.price}` : String(s.price);
      })
      .join(" · ");
  }

  const parts = String(sizePricesRaw || "").split(",");
  const labeled = [];
  for (let index = 0; index < SIZE_LABELS.length; index += 1) {
    if (index >= parts.length) break;
    const price = parseFloat(String(parts[index] ?? "").trim());
    if (!Number.isFinite(price) || price < 1) continue;
    const tag = ["S", "M", "L"][index];
    labeled.push(`${tag}: ${price}`);
  }
  if (labeled.length > 0) {
    return labeled.length === 1 ? labeled[0].replace(/^[SML]:\s*/, "") : labeled.join(" · ");
  }

  // Do not fall back to products.price — empty means no price shown.
  return "—";
}

export function isCustomizeBowlItem(item) {
  const category = String(item?.category || "").trim().toLowerCase();
  const categoryRaw = String(item?.categoryRaw || item?.categoryName || "").trim().toLowerCase();
  const name = String(item?.name || "").trim().toLowerCase();
  return (
    category.includes("customize") ||
    categoryRaw.includes("customize") ||
    name.includes("customize your bowl")
  );
}

/** Flat surcharge applied on Large for each selected oat base (Customize bowl). */
export const CUSTOMIZE_LARGE_OAT_BASE_EXTRA = 15;

export function getCustomizeMediumPrice(item, sizes = []) {
  const priced = filterPricedSizes(sizes);
  const medium =
    priced.find((s) => String(s.label).toLowerCase() === "medium") ||
    priced[0];
  if (medium && Number.isFinite(Number(medium.price))) return Number(medium.price);
  const fallback = parseFloat(item?.price);
  return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
}

export function getOatBaseSelectedQuantity(selectedAddons = []) {
  return (selectedAddons || []).reduce((sum, addon) => {
    const cat = String(addon.category || addon.categoryName || "").toLowerCase();
    if (!(cat.includes("oat") && cat.includes("base"))) return sum;
    const qty = parseInt(addon.quantity, 10);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);
}

/**
 * Customize bowl: only Medium + Large labels.
 * Bowl size itself has no price — Large adds ₹15 onto each oat base addon.
 */
export function buildCustomizeSizeOptions(item, sizes = []) {
  const source = Array.isArray(sizes) ? sizes : [];
  const mediumSource =
    source.find((s) => String(s.label).toLowerCase() === "medium") ||
    source.find((s) => String(s.label).toLowerCase() !== "small") ||
    source[0] ||
    {};
  const largeSource =
    source.find((s) => String(s.label).toLowerCase() === "large") ||
    mediumSource;

  // When priced sizes were stripped (customize bowls have no bowl price),
  // still resolve Medium/Large grams + calories from admin size meta.
  const gramsRaw = item?.sizeGramsRaw || "";
  const caloriesRaw = item?.sizeCaloriesRaw || item?.calories || "";
  const mediumGrams =
    mediumSource.grams ??
    (gramsRaw
      ? (() => {
          const parts = String(gramsRaw).split(",").map((p) => parseInt(String(p).trim(), 10));
          return Number.isFinite(parts[1]) && parts[1] > 0
            ? parts[1]
            : Number.isFinite(parts[0]) && parts[0] > 0
              ? parts[0]
              : undefined;
        })()
      : undefined);
  const largeGrams =
    largeSource.grams ??
    (gramsRaw
      ? (() => {
          const parts = String(gramsRaw).split(",").map((p) => parseInt(String(p).trim(), 10));
          return Number.isFinite(parts[2]) && parts[2] > 0
            ? parts[2]
            : mediumGrams;
        })()
      : undefined);
  const mediumCalories =
    mediumSource.calories ??
    (caloriesRaw
      ? (() => {
          const parts = String(caloriesRaw).split(",").map((p) => parseFloat(String(p).trim()));
          const pick = Number.isFinite(parts[1]) ? parts[1] : parts[0];
          return Number.isFinite(pick) ? Math.round(pick) : undefined;
        })()
      : undefined);
  const largeCalories =
    largeSource.calories ??
    (caloriesRaw
      ? (() => {
          const parts = String(caloriesRaw).split(",").map((p) => parseFloat(String(p).trim()));
          const pick = Number.isFinite(parts[2]) ? parts[2] : mediumCalories;
          return Number.isFinite(pick) ? Math.round(pick) : undefined;
        })()
      : undefined);

  return [
    {
      ...mediumSource,
      label: "Medium",
      price: 0,
      hidePrice: true,
      priceMode: "label-only",
      ...(mediumGrams != null ? { grams: mediumGrams } : {}),
      ...(mediumCalories != null ? { calories: mediumCalories } : {}),
    },
    {
      ...largeSource,
      label: "Large",
      price: 0,
      hidePrice: true,
      priceMode: "label-only",
      appliesOatBaseExtra: true,
      oatBaseExtraEach: CUSTOMIZE_LARGE_OAT_BASE_EXTRA,
      ...(largeGrams != null ? { grams: largeGrams } : {}),
      ...(largeCalories != null ? { calories: largeCalories } : {}),
    },
  ];
}

/** Charged unit price for a customize addon (Large adds ₹15 to oat bases). */
export function getCustomizeAddonUnitPrice(addon, sizeLabel = "Medium") {
  const base = Number(addon?.basePrice ?? addon?.price) || 0;
  const cat = addon?.category || addon?.categoryName || "";
  const isOatBase =
    String(cat).toLowerCase().includes("oat") && String(cat).toLowerCase().includes("base");
  if (String(sizeLabel) === "Large" && isOatBase) {
    return base + CUSTOMIZE_LARGE_OAT_BASE_EXTRA;
  }
  return base;
}
