export const SIZE_LABELS = ["Small", "Medium", "Large"];

export const DEFAULT_SIZE_LABEL = "Small";

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
  return tail.split(" || sub_category:")[0].split(" || size_grams:")[0].trim();
}

export function extractSizeGramsRaw(description = "") {
  if (!description || !description.includes(" || size_grams:")) return "";
  return description.split(" || size_grams:")[1]?.trim() || "";
}

export function parseDescriptionParts(description = "") {
  let cleanDescription = String(description || "").trim();
  let subCategory = "regular";
  let sizePricesRaw = "";
  let sizeGramsRaw = "";

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

  return { cleanDescription, subCategory, sizePricesRaw, sizeGramsRaw };
}

export function buildDescriptionWithMeta(description, subCategory, sizePricesRaw, sizeGramsRaw) {
  let result = stripSizeGramsFromDescription(stripSizePricesFromDescription(description || "")).trim();
  if (subCategory && subCategory !== "regular") {
    result = `${result} || sub_category:${subCategory}`;
  }
  if (sizePricesRaw && String(sizePricesRaw).trim()) {
    result = `${result} || size_prices:${String(sizePricesRaw).trim()}`;
  }
  if (sizeGramsRaw && String(sizeGramsRaw).trim()) {
    result = `${result} || size_grams:${String(sizeGramsRaw).trim()}`;
  }
  return result;
}

export function parseSizePrices(sizePricesRaw, fallbackPrice) {
  const fallback = parseFloat(fallbackPrice);
  const base = Number.isFinite(fallback) ? fallback : 0;

  if (!sizePricesRaw || !String(sizePricesRaw).trim()) {
    return [{ label: SIZE_LABELS[0], price: base }];
  }

  const prices = String(sizePricesRaw)
    .split(",")
    .map((part) => parseFloat(part.trim()))
    .filter((num) => Number.isFinite(num) && num >= 0);

  if (prices.length === 0) {
    return [{ label: SIZE_LABELS[0], price: base }];
  }

  // If only Small + Medium are stored, derive Large using the same step as Medium
  if (prices.length === 2) {
    const step = prices[1] - prices[0];
    if (step > 0) {
      prices.push(prices[1] + step);
    }
  }

  return prices.slice(0, SIZE_LABELS.length).map((price, index) => ({
    label: SIZE_LABELS[index] || `Size ${index + 1}`,
    price
  }));
}

export function normalizeSizePricesInput(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().replace(/[^\d.]/g, ""))
    .filter(Boolean)
    .join(",");
}

/** Allow comma-separated digits while typing (do not strip trailing commas). */
export function sanitizeSizePricesInput(value) {
  return String(value || "")
    .replace(/[^\d.,\s]/g, "")
    .replace(/\s+/g, "");
}
