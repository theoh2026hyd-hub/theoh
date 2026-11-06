import { canRedeemCoins, getSettingNumber, hasSettingsLoaded } from "./settings";

const CHECKOUT_RESUME_KEY = "theoh_checkout_resume";

export function saveCheckoutResumeDraft(draft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CHECKOUT_RESUME_KEY,
      JSON.stringify({
        ...draft,
        savedAt: Date.now(),
      })
    );
    window.dispatchEvent(new CustomEvent("theoh-checkout-resume-change"));
  } catch {
    // Ignore storage failures.
  }
}

export function readCheckoutResumeDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCheckoutResumeDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CHECKOUT_RESUME_KEY);
  window.dispatchEvent(new CustomEvent("theoh-checkout-resume-change"));
}

export function buildCheckoutOrderSummary({
  cart = [],
  settings = {},
  userCoins = 0,
  coinDiscountApplied = false,
  promoDiscountPercent = 0,
  isProfileComplete = false,
}) {
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.price + (item.addonsTotal || 0)) * item.quantity,
    0
  );
  const coinsCanRedeem = canRedeemCoins(settings, subtotal);
  const coinDiscountVal =
    coinDiscountApplied && coinsCanRedeem ? Math.min(subtotal, userCoins * 1) : 0;
  const promoDiscountVal = (subtotal - coinDiscountVal) * (promoDiscountPercent / 100);
  const totalDiscount = coinDiscountVal + promoDiscountVal;
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const gstPercent = getSettingNumber(settings, "gst_percent");
  const settingsReady = hasSettingsLoaded(settings);
  const taxRate = gstPercent !== null ? gstPercent / 100 : 0;
  const tax = settingsReady ? taxableAmount * taxRate : 0;
  const grandTotal = settingsReady ? taxableAmount + tax : 0;

  return {
    subtotal,
    coinDiscount: coinDiscountVal,
    promoDiscount: promoDiscountVal,
    tax,
    grandTotal,
    couponCode: "",
    userCoins: isProfileComplete ? userCoins : 0,
    useCoins: coinDiscountApplied && coinsCanRedeem && isProfileComplete,
  };
}
