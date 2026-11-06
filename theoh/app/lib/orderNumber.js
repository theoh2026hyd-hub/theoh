export function formatOrderNumber(orderNumber) {
  if (orderNumber == null || orderNumber === "") return null;
  const numeric = Number(orderNumber);
  if (Number.isNaN(numeric) || numeric < 0) return null;
  return String(Math.floor(numeric)).padStart(6, "0");
}

export function getOrderDisplayId(order) {
  if (!order) return null;
  const formatted = formatOrderNumber(order.orderNumber ?? order.order_number);
  return formatted ? `#${formatted}` : null;
}
