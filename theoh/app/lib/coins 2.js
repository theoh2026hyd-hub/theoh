export const COIN_EARN_RATE = 0.02;

/** Earn 2% of items subtotal (rounded to nearest whole coin). */
export function calculateCoinsEarned(itemsSubtotal) {
  const subtotal = parseFloat(itemsSubtotal) || 0;
  return Math.round(subtotal * COIN_EARN_RATE);
}
