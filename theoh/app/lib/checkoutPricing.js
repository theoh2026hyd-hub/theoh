import { getMenu, verifyAndApplyCoupon, getWalletDetails } from "./dbService";
import {
  getDeliveryFeeFromCoordsAsync,
  isTakeawayAddress,
  resolveDeliveryCoords
} from "./delivery";
import { supabase } from "./supabaseClient";
import { getSettingNumber, canRedeemCoins, getDeliveryPricingSettings } from "./settings";
import {
  validateCartItems,
  calculateOrderTotals
} from "./checkoutPricingShared";

export * from "./checkoutPricingShared";

async function loadSettingsMap() {
  const { data: settingsData } = await supabase.from("settings").select("*");
  const settings = {};
  (settingsData || []).forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

async function resolveDeliveryFeeForAddress(deliveryAddress, settings) {
  if (!deliveryAddress || isTakeawayAddress(deliveryAddress)) {
    return { deliveryFee: 0, withinRadius: true, distanceKm: 0, maxKm: null };
  }

  const pricing = getDeliveryPricingSettings(settings);
  const coords = await resolveDeliveryCoords(deliveryAddress);
  if (coords) {
    const result = await getDeliveryFeeFromCoordsAsync(coords.lat, coords.lng, pricing);
    return {
      deliveryFee: result.deliveryFee,
      withinRadius: result.withinRadius !== false,
      distanceKm: result.distanceKm,
      maxKm: result.maxKm ?? pricing.maxKm
    };
  }

  return {
    deliveryFee: pricing.baseFee,
    withinRadius: true,
    distanceKm: null,
    maxKm: pricing.maxKm
  };
}

export async function buildCheckoutQuote(body) {
  const { cartItems, customerPhone, couponCode, useCoins, deliveryAddress } = body;

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return { success: false, error: "Cart is empty.", status: 400 };
  }

  if (!customerPhone) {
    return { success: false, error: "Customer phone number is required.", status: 400 };
  }

  const dbMenu = await getMenu();
  const validation = validateCartItems(cartItems, dbMenu);
  if (!validation.success) {
    return { success: false, error: validation.error, status: 400 };
  }

  const settings = await loadSettingsMap();

  let promoDiscountVal = 0;
  let validatedCouponCode = null;
  if (couponCode) {
    const couponCheck = await verifyAndApplyCoupon(
      couponCode,
      customerPhone,
      validation.calculatedSubtotal
    );
    if (!couponCheck.valid) {
      return { success: false, error: couponCheck.message, status: 400 };
    }
    validatedCouponCode = couponCheck.code;
    promoDiscountVal = parseFloat(
      ((validation.calculatedSubtotal * couponCheck.discount_percent) / 100).toFixed(2)
    );
  }

  const wallet = await getWalletDetails(customerPhone);
  let coinDiscountVal = 0;
  if (useCoins) {
    if (!canRedeemCoins(settings, validation.calculatedSubtotal)) {
      const minAmount = getSettingNumber(settings, "coins_min_order_amount") ?? 1000;
      return {
        success: false,
        error: `Coins can only be used when item total is ₹${minAmount.toFixed(0)} or more.`,
        status: 400
      };
    }
    if (wallet && wallet.balance > 0) {
      coinDiscountVal = Math.min(validation.calculatedSubtotal, wallet.balance * 1.0);
      coinDiscountVal = parseFloat(coinDiscountVal.toFixed(2));
    }
  }

  const deliveryResult = await resolveDeliveryFeeForAddress(deliveryAddress, settings);
  if (deliveryResult.withinRadius === false) {
    const maxKm = deliveryResult.maxKm ?? 50;
    return {
      success: false,
      error: `Delivery is available only within ${maxKm} km of our kitchen. Your location is about ${deliveryResult.distanceKm} km away.`,
      status: 400
    };
  }

  const totals = calculateOrderTotals({
    subtotal: validation.calculatedSubtotal,
    settings,
    deliveryFee: deliveryResult.deliveryFee,
    promoDiscountVal,
    coinDiscountVal
  });

  return {
    success: true,
    totals,
    validatedItems: validation.validatedItems,
    validatedCouponCode
  };
}
