import { DEFAULT_SIZE_LABEL } from "./productSizes";
import { getItemBaseName, getItemSizeLabel } from "./cartDisplay";
import { normalizeOrderItems } from "./orderEnjoyDetails";
import { getCaloriesForSize } from "./productCalories";
import { getGramsForSize } from "./productPortions";
import { resolveProductImage } from "./productImages";
import { computeAddonsTotal, normalizeAddonKey } from "./addonHelpers";

export function findMenuItemForOrderItem(orderItem, menuItems = []) {
  const productId = orderItem.product_id ?? orderItem.productId ?? orderItem.id;
  if (productId) {
    const byId = menuItems.find((item) => Number(item.id) === Number(productId));
    if (byId) return byId;
  }

  const baseName = getItemBaseName(orderItem);
  const normalizedBase = baseName.trim().toLowerCase();
  const normalizedOrderName = String(orderItem.name || "").trim().toLowerCase();

  return menuItems.find((item) => {
    const menuBase = getItemBaseName({ name: item.name }).trim().toLowerCase();
    const menuName = String(item.name || "").trim().toLowerCase();
    return (
      menuName === normalizedOrderName ||
      menuBase === normalizedBase ||
      menuName === normalizedBase ||
      menuBase === normalizedOrderName
    );
  });
}

export function orderItemToCartLine(orderItem, menuItem) {
  const normalized = {
    ...orderItem,
    name: orderItem.name,
    quantity: orderItem.quantity || 1,
    selectedAddons: orderItem.selectedAddons || orderItem.selected_addons || [],
    selected_addons: orderItem.selected_addons || orderItem.selectedAddons || []
  };

  const sizeLabel = getItemSizeLabel(normalized) || DEFAULT_SIZE_LABEL;
  const baseName = getItemBaseName(normalized);
  const selectedAddons = Array.isArray(normalized.selectedAddons) ? normalized.selectedAddons : [];
  const matchedSize =
    menuItem.sizes?.find((size) => size.label === sizeLabel) ||
    menuItem.sizes?.[0];
  const price = parseFloat(matchedSize?.price ?? menuItem.price ?? normalized.price ?? 0);

  return {
    ...menuItem,
    id: Number(menuItem.id),
    name: baseName || menuItem.name,
    price,
    sizeLabel,
    portionGrams:
      matchedSize?.grams ?? getGramsForSize(menuItem.sizeGramsRaw, sizeLabel),
    calories:
      matchedSize?.calories ??
      getCaloriesForSize(menuItem.calories, sizeLabel, menuItem.sizeCaloriesRaw),
    selectedAddons,
    addonsTotal: computeAddonsTotal(selectedAddons),
    quantity: normalized.quantity || 1,
    image:
      menuItem.image ||
      resolveProductImage(menuItem.image, menuItem.category, baseName || menuItem.name),
    inStock: menuItem.inStock !== false && menuItem.in_stock !== false,
    stockQuantity: menuItem.stockQuantity ?? menuItem.quantity ?? null
  };
}

export function mergeCartLines(existingCart = [], incomingLines = []) {
  const cartLineKey = (line) =>
    `${Number(line.id)}|${line.sizeLabel || DEFAULT_SIZE_LABEL}|${normalizeAddonKey(line.selectedAddons)}`;

  const merged = [...existingCart];

  incomingLines.forEach((incoming) => {
    const matchIdx = merged.findIndex((line) => cartLineKey(line) === cartLineKey(incoming));
    if (matchIdx > -1) {
      merged[matchIdx] = {
        ...merged[matchIdx],
        quantity: merged[matchIdx].quantity + incoming.quantity,
        selectedAddons: incoming.selectedAddons,
        addonsTotal: incoming.addonsTotal,
        price: incoming.price,
        sizeLabel: incoming.sizeLabel,
        portionGrams: incoming.portionGrams ?? merged[matchIdx].portionGrams,
        calories: incoming.calories ?? merged[matchIdx].calories
      };
      return;
    }
    merged.push(incoming);
  });

  return merged;
}

export function repeatOrderItemsToCart(order, menuItems = [], existingCart = []) {
  const items = normalizeOrderItems(order?.itemsList || []);
  const warnings = [];
  const lines = [];

  if (items.length === 0) {
    return {
      cart: existingCart,
      added: 0,
      itemCount: 0,
      warnings: ["This order has no items to repeat."]
    };
  }

  items.forEach((item) => {
    const label = getItemBaseName(item) || item.name || "Item";
    const menuItem = findMenuItemForOrderItem(item, menuItems);

    if (!menuItem) {
      warnings.push(`${label} is no longer on the menu.`);
      return;
    }

    if (menuItem.inStock === false || menuItem.in_stock === false) {
      warnings.push(`${label} is currently out of stock.`);
      return;
    }

    lines.push(orderItemToCartLine(item, menuItem));
  });

  if (lines.length === 0) {
    return {
      cart: existingCart,
      added: 0,
      itemCount: 0,
      warnings
    };
  }

  const itemCount = lines.reduce((sum, line) => sum + (line.quantity || 1), 0);

  return {
    cart: mergeCartLines(existingCart, lines),
    added: lines.length,
    itemCount,
    warnings
  };
}
