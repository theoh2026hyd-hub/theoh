/** Addon taxonomy categories (not product menu sections). */
export const ADDON_GROUP_CATEGORIES = ["Oat Bases", "Fruits", "Nuts", "Seeds", "Butter", "Spreads"];

/** Bowl toppings shown only on Customize category products. */
export const BOWL_TOPPING_CATEGORIES = ["Oat Bases", "Fruits", "Nuts", "Seeds"];

/** Butter / spreads shown on Bread & Butter products. */
export const BREAD_SPREAD_CATEGORIES = ["Breads", "Spreads", "Butter", "Bread & Butter"];

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
  // Keep "Bread & Butter" distinct from "Breads" so admin title toggles work per category.
  if (lower === "bread" || lower === "breads") {
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
      key = "Butter";
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

/** Categories where only one addon can be selected (qty 1). */
export function isSingleSelectAddonCategory(categoryName = "") {
  const n = String(categoryName || "").toLowerCase();
  return n.includes("oat") && n.includes("base");
}

/** Categories capped at total quantity across all items in the group (Customize bowls only). */
export function getAddonCategoryQuantityLimit(categoryName = "", { enforceLimits = false } = {}) {
  if (!enforceLimits) return null;
  const n = String(categoryName || "").trim().toLowerCase();
  if (n === "fruits" || n.includes("fruit")) return 3;
  if (n === "nuts" || n === "nut") return 3;
  if (n === "seeds" || n === "seed" || n.includes("seed")) return 3;
  return null;
}

export function getSelectedQtyInCategory(selectedAddons = [], categoryName = "") {
  const key = String(categoryName || "").trim().toLowerCase();
  return (selectedAddons || []).reduce((sum, addon) => {
    const cat = String(addon.category || addon.categoryName || "").trim().toLowerCase();
    if (cat !== key) return sum;
    const qty = parseInt(addon.quantity, 10);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);
}

/**
 * Whether the user can add one more unit of this addon given current selection.
 */
export function canIncrementAddon(
  addon,
  selectedAddons = [],
  categoryName = "",
  { enforceLimits = false } = {}
) {
  const cat = categoryName || addon.category || addon.categoryName || "";
  const currentQty = selectedAddons.find((a) => a.id === addon.id)?.quantity || 0;

  if (enforceLimits && isSingleSelectAddonCategory(cat)) {
    const otherSelected = selectedAddons.some(
      (a) =>
        a.id !== addon.id &&
        isSingleSelectAddonCategory(a.category || a.categoryName || cat) &&
        (a.quantity || 0) > 0
    );
    if (otherSelected) return false;
    return currentQty < 1;
  }

  const limit = getAddonCategoryQuantityLimit(cat, { enforceLimits });
  if (limit == null) return true;

  const totalInCategory = getSelectedQtyInCategory(selectedAddons, cat);
  return totalInCategory < limit;
}

/**
 * True if this addon row should appear locked (cannot start/increase).
 */
export function isAddonBlocked(
  addon,
  selectedAddons = [],
  categoryName = "",
  { enforceLimits = false } = {}
) {
  const cat = categoryName || addon.category || addon.categoryName || "";
  const currentQty = selectedAddons.find((a) => a.id === addon.id)?.quantity || 0;

  if (enforceLimits && isSingleSelectAddonCategory(cat)) {
    if (currentQty > 0) return false;
    return selectedAddons.some(
      (a) =>
        a.id !== addon.id &&
        isSingleSelectAddonCategory(a.category || a.categoryName || cat) &&
        (a.quantity || 0) > 0
    );
  }

  const limit = getAddonCategoryQuantityLimit(cat, { enforceLimits });
  if (limit == null) return false;
  if (currentQty > 0) {
    return getSelectedQtyInCategory(selectedAddons, cat) >= limit;
  }
  return getSelectedQtyInCategory(selectedAddons, cat) >= limit;
}

/** Short user-facing rule for an addon category. */
export function getAddonCategoryHint(categoryName = "", { enforceLimits = false } = {}) {
  if (enforceLimits && isSingleSelectAddonCategory(categoryName)) {
    return "You can only pick one oat base.";
  }
  const limit = getAddonCategoryQuantityLimit(categoryName, { enforceLimits });
  if (limit != null) {
    return `You can pick up to ${limit} quantity from this category.`;
  }
  return "";
}
