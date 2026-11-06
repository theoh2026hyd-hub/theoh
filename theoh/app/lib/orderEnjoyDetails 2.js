import { resolveProductImage } from "./productImages";

function parseAddons(addons = []) {
  if (!addons) return [];
  if (Array.isArray(addons)) return addons;
  if (typeof addons === "string") {
    try {
      const parsed = JSON.parse(addons);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getAddonsTotal(addons = []) {
  return parseAddons(addons).reduce((sum, addon) => {
    const qty = Math.max(1, parseInt(addon.quantity, 10) || 1);
    return sum + parseFloat(addon.price || 0) * qty;
  }, 0);
}

export function detectDiningMode(address = "") {
  const value = String(address || "").toLowerCase();
  if (value.includes("takeaway") || value.includes("pickup")) {
    return "takeaway";
  }
  return "delivery";
}

export function parsePickupTable(address = "") {
  const match = String(address || "").match(/Pickup:\s*([^)]+)/i);
  return match ? match[1].trim() : "";
}

export function formatDeliveryAddress(order = {}) {
  if (order.diningMode === "takeaway") {
    return order.tableNo ? `Pickup: ${order.tableNo}` : "Pickup location not specified";
  }
  const address = order.deliveryAddress || order.location || "";
  return address.split(" || Map: ")[0] || "Not available";
}

export function parseScheduleFromInstructions(instructions = "") {
  const value = String(instructions || "");
  const match = value.match(/Scheduled delivery\/pickup:\s*(.+?)(?:\n|$)/i);
  return match ? match[1].trim() : "";
}

export function parseAdditionalRequests(instructions = "") {
  return String(instructions || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^Scheduled delivery\/pickup:/i.test(line))
    .join("\n")
    .trim();
}

export function formatScheduleLabel(order = {}) {
  return (
    order.deliveryDateTime ||
    order.delivery_date_time ||
    order.scheduled ||
    parseScheduleFromInstructions(order.specialInstructions || order.special_instructions) ||
    "Not scheduled"
  );
}

export function normalizeOrderItem(item = {}) {
  const addons = parseAddons(item.selected_addons || item.selectedAddons);
  const addonsTotal = item.addonsTotal ?? getAddonsTotal(addons);

  return {
    ...item,
    name: item.name || "",
    quantity: item.quantity || 1,
    price: parseFloat(item.price || 0),
    selectedAddons: addons,
    selected_addons: addons,
    addonsTotal,
    image: item.image || resolveProductImage(item.image, item.category || "Oats", item.name)
  };
}

export function normalizeOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map(normalizeOrderItem);
}

export function parseItemsFromSummary(summary = "") {
  if (!summary || typeof summary !== "string") return [];

  return summary.split(",").map((part) => {
    const trimmed = part.trim();
    const qtyFirst = trimmed.match(/^(\d+)x\s+(.+)$/i);
    const qtyLast = trimmed.match(/^(.+?)\s+x(\d+)$/i);
    let name = trimmed;
    let quantity = 1;

    if (qtyFirst) {
      quantity = parseInt(qtyFirst[1], 10) || 1;
      name = qtyFirst[2].trim();
    } else if (qtyLast) {
      name = qtyLast[1].trim();
      quantity = parseInt(qtyLast[2], 10) || 1;
    }

    return normalizeOrderItem({
      name,
      quantity,
      price: 0,
      selected_addons: []
    });
  });
}

export function buildOrderEnjoyDetails(order = {}, settings = {}) {
  const deliveryAddress = order.deliveryAddress || order.location || "";
  const diningMode = order.diningMode || detectDiningMode(deliveryAddress);
  const tableNo = order.tableNo || parsePickupTable(deliveryAddress);
  const subtotal = parseFloat(order.subtotal ?? 0);
  const coinDiscount = parseFloat(order.coinDiscount ?? order.coin_discount ?? 0);
  const promoDiscount = parseFloat(order.promoDiscount ?? order.promo_discount ?? 0);
  const tax = parseFloat(order.tax ?? 0);
  const grandTotal = parseFloat(order.grandTotal ?? order.total ?? 0);
  const taxableAmount = Math.max(0, subtotal - coinDiscount - promoDiscount);
  const configuredPacking = parseFloat(settings.packing_charge ?? order.packingFee ?? 10);
  const remainder = Math.max(0, parseFloat((grandTotal - taxableAmount - tax).toFixed(2)));

  let packingFee = order.packingFee ?? order.packing_fee;
  let deliveryFee = order.deliveryFee ?? order.delivery_fee;

  if (packingFee == null || deliveryFee == null) {
    if (diningMode === "delivery") {
      packingFee = Math.min(configuredPacking, remainder);
      deliveryFee = Math.max(0, remainder - packingFee);
    } else {
      packingFee = remainder;
      deliveryFee = 0;
    }
  }

  const itemsList =
    normalizeOrderItems(order.itemsList).length > 0
      ? normalizeOrderItems(order.itemsList)
      : parseItemsFromSummary(order.items);

  const gstPercent =
    order.gstPercent ??
    order.gst_percent ??
    (tax > 0 && taxableAmount > 0
      ? parseFloat(((tax / taxableAmount) * 100).toFixed(2))
      : parseFloat(settings.gst_percent ?? 8));

  return {
    ...order,
    diningMode,
    tableNo,
    location: diningMode === "delivery" ? deliveryAddress : "",
    deliveryAddress,
    customerName: order.customerName || order.customer_name || order.receiverName || "Guest",
    customerPhone: order.customerPhone || order.customer_phone || order.receiverPhone || "Not available",
    scheduled: formatScheduleLabel(order),
    subtotal,
    coinDiscount,
    promoDiscount,
    tax,
    packingFee: parseFloat(packingFee || 0),
    deliveryFee: parseFloat(deliveryFee || 0),
    grandTotal,
    coinsEarned: parseInt(order.coinsEarned ?? order.coins_earned ?? 0, 10),
    gstPercent,
    restaurantAddress:
      order.restaurantAddress || settings.restaurant_address || "Malkam Cheruvu Heritage Rocks, Hyderabad",
    promoCode: order.promoCode || order.coupon_code || order.couponCode || "",
    itemsList
  };
}
