/** Addon taxonomy categories (not product menu sections). */
export const ADDON_GROUP_CATEGORIES = ["Fruits", "Nuts", "Seeds", "Spreads"];

/** Bowl toppings shown on Oats products. */
export const BOWL_TOPPING_CATEGORIES = ["Fruits", "Nuts", "Seeds"];

/** Spreads shown on Breads products. */
export const BREAD_SPREAD_CATEGORIES = ["Breads", "Spreads", "Butter"];

export function isAddonGroupCategory(name) {
  if (!name) return false;
  return ADDON_GROUP_CATEGORIES.some(
    (entry) => entry.toLowerCase() === String(name).trim().toLowerCase()
  );
}

export function isBreadSpreadCategory(name) {
  if (!name) return false;
  return BREAD_SPREAD_CATEGORIES.some(
    (entry) => entry.toLowerCase() === String(name).trim().toLowerCase()
  );
}

export function normalizeMenuCategory(name) {
  const value = String(name || "").trim();
  if (!value) return value;
  const lower = value.toLowerCase();
  if (lower === "bread & butter" || lower === "bread" || lower === "breads") {
    return "Breads";
  }
  return value;
}

export function getAddonQuantity(addon) {
  const qty = parseInt(addon?.quantity, 10);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

export function computeAddonsTotal(addons = []) {
  return addons.reduce((sum, addon) => {
    const qty = getAddonQuantity(addon) || 1;
    return sum + parseFloat(addon?.price || 0) * qty;
  }, 0);
}

export function normalizeAddonKey(addons = []) {
  return [...addons]
    .map((addon) => {
      const qty = getAddonQuantity(addon) || 1;
      return `${addon.name}::${Number(addon.price)}::${qty}`;
    })
    .sort()
    .join("|");
}

export function formatAddonSelectionLabel(addon) {
  const qty = getAddonQuantity(addon) || 1;
  const price = parseFloat(addon?.price || 0).toFixed(0);
  return qty > 1
    ? `${addon.name} ×${qty} (+₹${price} each)`
    : `${addon.name} (+₹${price})`;
}

export function groupAddonsByCategory(addons = []) {
  const order = [...ADDON_GROUP_CATEGORIES, "Other"];
  const groups = new Map(order.map((name) => [name, []]));

  for (const addon of addons) {
    const categoryName = String(addon.categoryName || addon.category || "").trim();
    let key = "Other";
    if (isBreadSpreadCategory(categoryName)) {
      key = "Spreads";
    } else {
      const matched = ADDON_GROUP_CATEGORIES.find(
        (entry) => entry.toLowerCase() === categoryName.toLowerCase()
      );
      if (matched) key = matched;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(addon);
  }

  return order
    .filter((name) => (groups.get(name) || []).length > 0)
    .map((name) => ({ category: name, addons: groups.get(name) }));
}
