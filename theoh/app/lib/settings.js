export function getSettingValue(settings, key) {
  if (!settings || settings[key] === undefined || settings[key] === null) return null;
  const value = String(settings[key]).trim();
  return value === "" ? null : value;
}

export function getSettingNumber(settings, key) {
  const value = getSettingValue(settings, key);
  if (value === null) return null;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

export function hasSettingsLoaded(settings, keys = ["gst_percent", "packing_charge"]) {
  if (!settings || typeof settings !== "object") return false;
  return keys.every((key) => getSettingValue(settings, key) !== null);
}

export function getCoinsRedemptionSettings(settings = {}) {
  const enabledRaw = getSettingValue(settings, "coins_redemption_enabled");
  const minRaw = getSettingNumber(settings, "coins_min_order_amount");

  return {
    enabled: enabledRaw === null ? true : !["false", "0", "no", "off"].includes(enabledRaw.toLowerCase()),
    minOrderAmount: minRaw ?? 1000
  };
}

export function canRedeemCoins(settings = {}, orderSubtotal = 0) {
  const { enabled, minOrderAmount } = getCoinsRedemptionSettings(settings);
  if (!enabled) return false;
  return Number(orderSubtotal) >= minOrderAmount;
}

export function getDeliveryPricingSettings(settings = {}) {
  return {
    baseKm: getSettingNumber(settings, "delivery_base_km") ?? 3,
    baseFee: getSettingNumber(settings, "delivery_base_fee") ?? 100,
    extraKmPrice: getSettingNumber(settings, "delivery_extra_km_price") ?? 15,
    maxKm: getSettingNumber(settings, "delivery_max_km") ?? 50
  };
}

export function formatDeliveryPricingLabel(settings = {}) {
  const { baseKm, baseFee, extraKmPrice, maxKm } = getDeliveryPricingSettings(settings);
  return `up to ${baseKm} km ₹${baseFee}, +₹${extraKmPrice}/km beyond (max ${maxKm} km)`;
}

function isSettingEnabled(settings, key, defaultValue = true) {
  const raw = getSettingValue(settings, key);
  if (raw === null) return defaultValue;
  return !["false", "0", "no", "off"].includes(raw.toLowerCase());
}

/** Whether item/addon calorie labels are shown on the storefront and admin lists. */
export function isCaloriesDisplayEnabled(settings = {}) {
  return isSettingEnabled(settings, "show_calories", true);
}

/** Whether item/addon gram/portion labels are shown on the storefront and admin lists. */
export function isGramsDisplayEnabled(settings = {}) {
  return isSettingEnabled(settings, "show_grams", true);
}
