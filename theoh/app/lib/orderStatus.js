export function isDeliveredOrderStatus(status) {
  const s = (status || "").toLowerCase();
  return s === "delivered & plated" || s === "delivered";
}

export function isCancelledOrderStatus(status) {
  return (status || "").toLowerCase() === "cancelled";
}

/** Active / in-progress orders (still being prepared or awaiting delivery). */
export function isActiveOrderStatus(status) {
  return !isDeliveredOrderStatus(status) && !isCancelledOrderStatus(status);
}

/** Previous orders — only after admin marks delivered (or cancelled). */
export function isPreviousOrderStatus(status) {
  return isDeliveredOrderStatus(status) || isCancelledOrderStatus(status);
}
