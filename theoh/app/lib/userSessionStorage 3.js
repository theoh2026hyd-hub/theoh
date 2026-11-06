export const LEGACY_CART_KEY = "theoh_cart";

export function getUserCartKey(userId) {
  return userId ? `theoh_cart_${userId}` : null;
}

export function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function readUserCart(userId) {
  if (!userId || typeof window === "undefined") return [];
  return readStoredJson(getUserCartKey(userId), []);
}

export function writeUserCart(userId, cart) {
  if (!userId || typeof window === "undefined") return;
  localStorage.setItem(getUserCartKey(userId), JSON.stringify(cart));
}

export function clearUserSessionStorage() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(LEGACY_CART_KEY);
  localStorage.removeItem("theoh_phone");
  localStorage.removeItem("theoh_coins");
  localStorage.removeItem("theoh_history");

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("theoh_cart_")) {
      localStorage.removeItem(key);
    }
  });
}

export function notifySessionCleared() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("theoh-session-cleared"));
}
