import { DEFAULT_SIZE_LABEL } from "./productSizes";
import { getSettingNumber } from "./settings";
import { calculateCoinsEarned } from "./coins";

function normalizeProductKey(name) {
  return String(name || "").trim().toLowerCase();
}

export function buildMenuMap(dbMenu = []) {
  const menuMap = {};
  dbMenu.forEach((item) => {
    if (item?.id == null) return;
    menuMap[item.id] = item;
    menuMap[String(item.id)] = item;
    const numericId = Number(item.id);
    if (Number.isFinite(numericId)) {
      menuMap[numericId] = item;
    }
  });
  return menuMap;
}

export function buildMenuLookup(dbMenu = []) {
  const byId = buildMenuMap(dbMenu);
  const byName = {};
  dbMenu.forEach((item) => {
    const nameKey = normalizeProductKey(item?.name);
    if (nameKey) byName[nameKey] = item;
  });
  return { byId, byName };
}

export function resolveMenuItem(cartItem, lookup) {
  if (!cartItem || !lookup) return null;

  const id = cartItem.id;
  if (id != null && id !== "") {
    const byIdHit =
      lookup.byId[id] ??
      lookup.byId[String(id)] ??
      lookup.byId[Number(id)];
    if (byIdHit) return byIdHit;
  }

  const nameKey = normalizeProductKey(cartItem.name);
  if (nameKey && lookup.byName[nameKey]) {
    return lookup.byName[nameKey];
  }

  return null;
}

export function resolveUnitPrice(cartItem, menuItem) {
  if (!menuItem) {
    const parsed = parseFloat(cartItem?.price);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const sizeLabel = cartItem?.sizeLabel || DEFAULT_SIZE_LABEL;
  if (Array.isArray(menuItem.sizes) && menuItem.sizes.length > 0) {
    const matchedSize =
      menuItem.sizes.find((size) => size.label === sizeLabel) || menuItem.sizes[0];
    const sizePrice = parseFloat(matchedSize?.price);
    if (Number.isFinite(sizePrice)) return sizePrice;
  }

  const basePrice = parseFloat(menuItem.price);
  return Number.isFinite(basePrice) ? basePrice : 0;
}

export function validateCartItems(cartItems = [], dbMenu = []) {
  const lookup = buildMenuLookup(dbMenu);
  let calculatedSubtotal = 0;
  const validatedItems = [];

  for (const item of cartItems) {
    const dbItem = resolveMenuItem(item, lookup);
    if (!dbItem) {
      return {
        success: false,
        error: `Product ${item.name || item.id} not found in database.`
      };
    }

    if (!dbItem.inStock) {
      return {
        success: false,
        error: `Product ${dbItem.name} is out of stock.`
      };
    }

    const stockQty = dbItem.quantity != null ? parseInt(dbItem.quantity, 10) : null;
    const cartQty = parseInt(item.quantity, 10) || 1;
    if (stockQty != null && cartQty > stockQty) {
      return {
        success: false,
        error: `Only ${stockQty} units of ${dbItem.name} are available.`
      };
    }

    let addonsTotal = 0;
    const validatedAddons = [];

    if (item.selectedAddons && Array.isArray(item.selectedAddons)) {
      for (const addon of item.selectedAddons) {
        const dbAddon = dbItem.addons?.find((entry) => entry.name === addon.name);
        if (dbAddon) {
          const qty = Math.max(1, parseInt(addon.quantity, 10) || 1);
          addonsTotal += dbAddon.price * qty;
          validatedAddons.push({
            id: dbAddon.id,
            name: dbAddon.name,
            price: dbAddon.price,
            grams: dbAddon.grams ?? 30,
            categoryName: dbAddon.categoryName || null,
            quantity: qty
          });
        }
      }
    }

    const itemPrice = resolveUnitPrice(item, dbItem);
    const unitTotal = itemPrice + addonsTotal;
    calculatedSubtotal += unitTotal * cartQty;

    validatedItems.push({
      id: dbItem.id,
      name: dbItem.name,
      price: itemPrice,
      quantity: cartQty,
      sizeLabel: item.sizeLabel || null,
      selectedAddons: validatedAddons,
      addonsTotal,
      stockQuantity: stockQty
    });
  }

  return {
    success: true,
    calculatedSubtotal: parseFloat(calculatedSubtotal.toFixed(2)),
    validatedItems
  };
}

export function calculateOrderTotals({
  subtotal = 0,
  settings = {},
  deliveryFee = 0,
  promoDiscountVal = 0,
  coinDiscountVal = 0
}) {
  const packingCharge = getSettingNumber(settings, "packing_charge") ?? 0;
  const taxRate = (getSettingNumber(settings, "gst_percent") ?? 0) / 100;
  const promoAndCoinDiscount = parseFloat((promoDiscountVal + coinDiscountVal).toFixed(2));
  const taxableAmount = Math.max(0, subtotal - promoAndCoinDiscount);
  const taxVal = parseFloat((taxableAmount * taxRate).toFixed(2));
  const grandTotalVal = parseFloat(
    (taxableAmount + taxVal + packingCharge + deliveryFee).toFixed(2)
  );

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    coinDiscount: parseFloat(coinDiscountVal.toFixed(2)),
    promoDiscount: parseFloat(promoDiscountVal.toFixed(2)),
    tax: taxVal,
    packingFee: packingCharge,
    deliveryFee,
    gstPercent: getSettingNumber(settings, "gst_percent") ?? 0,
    grandTotal: grandTotalVal,
    coinsEarned: calculateCoinsEarned(subtotal)
  };
}

export function reconcileCartWithMenu(cartLines = [], menuItems = []) {
  if (!Array.isArray(cartLines) || cartLines.length === 0) return cartLines;

  const lookup = buildMenuLookup(menuItems);

  return cartLines
    .map((line) => {
      const menuItem = resolveMenuItem(line, lookup);
      if (!menuItem) return null;

      const unitPrice = resolveUnitPrice(line, menuItem);
      const stockQuantity =
        menuItem.stockQuantity != null
          ? parseInt(menuItem.stockQuantity, 10)
          : menuItem.quantity != null
          ? parseInt(menuItem.quantity, 10)
          : null;
      const cartQuantity = parseInt(line.quantity, 10) || 1;

      return {
        ...line,
        id: menuItem.id,
        name: menuItem.name,
        price: unitPrice,
        image: menuItem.image ?? line.image,
        inStock: menuItem.inStock,
        stockQuantity,
        sizeGramsRaw: menuItem.sizeGramsRaw,
        sizes: menuItem.sizes,
        portionGrams:
          line.portionGrams ??
          menuItem.sizes?.find((size) => size.label === (line.sizeLabel || DEFAULT_SIZE_LABEL))?.grams ??
          null,
        quantity: stockQuantity != null ? Math.min(cartQuantity, stockQuantity) : cartQuantity
      };
    })
    .filter(Boolean);
}
