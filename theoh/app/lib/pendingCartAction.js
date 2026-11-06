const GUEST_CART_KEY = "theoh_guest_cart";
const PENDING_CART_ACTION_KEY = "theoh_pending_cart_action";

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readGuestCart() {
  const cart = readJson(GUEST_CART_KEY, []);
  return Array.isArray(cart) ? cart : [];
}

export function writeGuestCart(cart) {
  writeJson(GUEST_CART_KEY, Array.isArray(cart) ? cart : []);
}

export function clearGuestCart() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // Ignore.
  }
}

export function consumeGuestCart() {
  const cart = readGuestCart();
  clearGuestCart();
  return cart;
}

/** Append or merge a cart line into the guest cart (pre-login). */
export function upsertGuestCartLine(line, lineKeyFn) {
  if (!line) return;
  const cart = readGuestCart();
  const key = lineKeyFn(line);
  const matchIdx = cart.findIndex((entry) => lineKeyFn(entry) === key);
  let next;
  if (matchIdx > -1) {
    next = [...cart];
    next[matchIdx] = {
      ...next[matchIdx],
      ...line,
      quantity: (next[matchIdx].quantity || 0) + (line.quantity || 1),
    };
  } else {
    next = [...cart, line];
  }
  writeGuestCart(next);
}

/** @deprecated kept for migration of any in-flight sessionStorage pending actions */
export function readPendingCartAction() {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(PENDING_CART_ACTION_KEY) ||
      sessionStorage.getItem(PENDING_CART_ACTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingCartAction() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_CART_ACTION_KEY);
    sessionStorage.removeItem(PENDING_CART_ACTION_KEY);
  } catch {
    // Ignore.
  }
}

export function savePendingCartAction(action) {
  if (typeof window === "undefined" || !action) return;
  try {
    localStorage.setItem(
      PENDING_CART_ACTION_KEY,
      JSON.stringify({ ...action, savedAt: Date.now() })
    );
  } catch {
    // Ignore.
  }
}

export function consumePendingCartAction() {
  const action = readPendingCartAction();
  if (action) clearPendingCartAction();
  return action;
}
