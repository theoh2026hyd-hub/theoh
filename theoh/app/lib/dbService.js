import { supabase } from "./supabaseClient";
import { formatOrderNumber } from "./orderNumber";
import { lookupAddonCalories } from "./addonCalories";
import { resolveProductImage } from "./productImages";
import { getPhoneLast10 } from "./phone";
import {
  parseDescriptionParts,
  buildDescriptionWithMeta,
  parseSizePrices,
  extractSizePricesRaw,
  formatProductDescription,
  filterPricedSizes,
} from "./productSizes";
import { enrichSizesWithCalories } from "./productCalories";
import { enrichSizesWithPortions } from "./productPortions";
import { BOWL_TOPPING_CATEGORIES, normalizeMenuCategory, isBreadSpreadCategory } from "./addonHelpers";
import { hasMapLinkInAddress, isTakeawayAddress } from "./delivery";
import { sendNewOrderAdminEmail } from "./mailSender";

function shapeAddon(addon, categoryName) {
  const resolvedCategory = categoryName || null;
  return {
    id: addon.id,
    name: addon.name,
    price: parseFloat(addon.price),
    grams: addon.grams != null ? parseInt(addon.grams, 10) : 30,
    category: resolvedCategory,
    categoryName: resolvedCategory,
    isActive: addon.is_active !== false,
    calories:
      addon.calories != null
        ? parseFloat(addon.calories)
        : lookupAddonCalories(addon.name)
  };
}

/**
 * Fetch all menu categories, products, and their custom addons,
 * returning them formatted for the frontend client-side rendering.
 */
export async function getMenu() {
  if (!supabase) {
    throw new Error("Database is not configured. Check SUPABASE env vars.");
  }

  const [productsRes, addonsRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select(`
        *,
        categories (
          name,
          show_in_menu,
          show_section,
          show_calories,
          show_grams,
          show_ingredients,
          show_nutrients
        )
      `)
      .order("id", { ascending: true }),
    supabase
      .from("product_addons")
      .select(`
        id,
        name,
        price,
        calories,
        grams,
        category_id,
        is_active,
        categories (
          name,
          show_in_menu
        )
      `)
      .order("id", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, show_in_menu, show_section, show_calories, show_grams, show_ingredients, show_nutrients")
      .order("id", { ascending: true })
  ]);

  if (productsRes.error) {
    console.error("Error fetching menu from Supabase:", productsRes.error);
    throw productsRes.error;
  }
  if (addonsRes.error) {
    console.error("Error fetching addons from Supabase:", addonsRes.error);
    throw addonsRes.error;
  }
  if (categoriesRes.error) {
    console.error("Error fetching categories from Supabase:", categoriesRes.error);
    throw categoriesRes.error;
  }

  const categoryFlagsById = new Map();
  for (const category of categoriesRes.data || []) {
    categoryFlagsById.set(Number(category.id), {
      showInMenu: category.show_in_menu !== false,
      showSection: Boolean(category.show_section),
      showCalories: category.show_calories !== false,
      showGrams: category.show_grams !== false,
      showIngredients: category.show_ingredients !== false,
      showNutrients: category.show_nutrients !== false,
      id: category.id,
      name: normalizeMenuCategory(category.name),
      rawName: category.name,
    });
  }

  const allAddons = (addonsRes.data || [])
    .filter((addon) => addon.is_active !== false)
    .map((addon) => shapeAddon(addon, addon.categories?.name));

  const bowlToppings = allAddons.filter((addon) =>
    BOWL_TOPPING_CATEGORIES.some(
      (name) => name.toLowerCase() === String(addon.categoryName || "").toLowerCase()
    )
  );

  // Regular Oats items get Fruits / Nuts / Seeds — not Oat Bases (those are Customize-only).
  const oatsExtraToppings = allAddons.filter((addon) =>
    ["Fruits", "Nuts", "Seeds"].some(
      (name) => name.toLowerCase() === String(addon.categoryName || "").toLowerCase()
    )
  );

  const addonsByCategoryId = new Map();
  for (const addon of addonsRes.data || []) {
    if (addon.is_active === false) continue;
    const key = addon.category_id;
    if (!addonsByCategoryId.has(key)) addonsByCategoryId.set(key, []);
    addonsByCategoryId.get(key).push(shapeAddon(addon, addon.categories?.name));
  }

  // Format database records to match the frontend expectations
  return (productsRes.data || [])
    .map((item) => {
    const { cleanDescription, subCategory, sizePricesRaw, sizeGramsRaw, sizeCaloriesRaw } =
      parseDescriptionParts(item.description || "");
    const rawCategoryName = item.categories?.name || "Oats";
    const categoryName = normalizeMenuCategory(rawCategoryName);
    const flags = categoryFlagsById.get(Number(item.category_id)) || {
      showInMenu: item.categories?.show_in_menu !== false,
      showSection: Boolean(item.categories?.show_section),
      showCalories: item.categories?.show_calories !== false,
      showGrams: item.categories?.show_grams !== false,
      showIngredients: item.categories?.show_ingredients !== false,
      showNutrients: item.categories?.show_nutrients !== false,
    };
    const showInMenu = flags.showInMenu !== false;
    const showSection = Boolean(flags.showSection);
    const showCalories = flags.showCalories !== false;
    const showGrams = flags.showGrams !== false;
    const showIngredients = flags.showIngredients !== false;
    const showNutrients = flags.showNutrients !== false;
    // Category Show Menu OFF → hide all products in that category.
    if (!showInMenu) return null;
    // Product Show Menu OFF → hide this item only.
    if (item.show_in_menu === false) return null;

    const categoryLower = String(categoryName).trim().toLowerCase();
    const rawCategoryLower = String(rawCategoryName).trim().toLowerCase();
    const productNameLower = String(item.name || "").trim().toLowerCase();
    const isCustomize =
      categoryLower === "customize" ||
      categoryLower === "customize your bowl" ||
      rawCategoryLower === "customize" ||
      rawCategoryLower === "customize your bowl" ||
      productNameLower.includes("customize your bowl");
    const isOats = categoryLower === "oats" || rawCategoryLower === "oats";
    const isBreads =
      categoryLower === "breads" ||
      rawCategoryLower === "bread & butter";
    const isCookies =
      categoryLower === "cookies" ||
      categoryLower.includes("cookie") ||
      rawCategoryLower.includes("cookie");

    let sizes = enrichSizesWithPortions(
      enrichSizesWithCalories(
        parseSizePrices(sizePricesRaw, item.price),
        item.calories,
        sizeCaloriesRaw
      ),
      item.calories,
      sizeGramsRaw
    );
    sizes = filterPricedSizes(sizes);

    // If no size slots were configured but the base price exists, show that single price.
    if (sizes.length === 0) {
      const basePrice = Number(item.price);
      if (Number.isFinite(basePrice) && basePrice >= 1) {
        sizes = [{ label: "Regular", price: basePrice, hideSizeLabel: true }];
      }
    }

    // Cookies: package total weight below price (separate from serving_weight_g nutrition).
    const totalWeight = Number(item.total_weight_g);
    if (Number.isFinite(totalWeight) && totalWeight > 0 && isCookies) {
      sizes = sizes.map((size) => ({ ...size, grams: totalWeight }));
    }

    // Customize → full Craft Your Bowl (Oat Bases + Fruits + Nuts + Seeds)
    // Oats → Fruits / Nuts / Seeds addons (no Oat Bases)
    // Breads → Butter / spreads addons
    // Other → category-linked addons
    const addons = isCustomize
      ? bowlToppings
      : isOats
      ? oatsExtraToppings
      : isBreads
      ? allAddons.filter((addon) => isBreadSpreadCategory(addon.categoryName))
      : addonsByCategoryId.get(item.category_id) || [];

    return {
      id: item.id,
      name: item.name,
      price: sizes[0]?.price ?? 0,
      sizes,
      sizePricesRaw,
      sizeGramsRaw,
      sizeCaloriesRaw,
      calories: item.calories,
      rating: parseFloat(item.rating || 4.8),
      category: categoryName,
      categoryId: item.category_id != null ? Number(item.category_id) : null,
      categoryRaw: rawCategoryName,
      description: formatProductDescription(
        { name: item.name, category: categoryName, categoryRaw: rawCategoryName },
        cleanDescription
      ),
      subCategory,
      image: resolveProductImage(item.image, categoryName, item.name),
      inStock: item.in_stock !== false && (item.quantity == null || item.quantity > 0),
      quantity: item.quantity != null ? parseInt(item.quantity, 10) : null,
      stockQuantity: item.quantity != null ? parseInt(item.quantity, 10) : null,
      protein: item.protein,
      carbohydrates: item.carbohydrates,
      fats: item.fats,
      ingredients: item.ingredients,
      serving_size: item.serving_size,
      serving_weight_g: item.serving_weight_g,
      total_weight_g: item.total_weight_g,
      saturated_fat: item.saturated_fat,
      sugar: item.sugar,
      dietary_fibre: item.dietary_fibre,
      sodium_mg: item.sodium_mg,
      addons,
      showInMenu,
      showSection,
      showCalories,
      showGrams,
      showIngredients,
      showNutrients,
      productShowInMenu: item.show_in_menu !== false,
    };
  })
  .filter(Boolean);
}

/**
 * Return product IDs ranked by total quantity ordered (non-cancelled orders).
 */
export async function getMostOrderedProductIds(limit = 50) {
  if (!supabase) return [];

  try {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, status");

    if (ordersError || !orders?.length) return [];

    const validOrderIds = orders
      .filter((order) => (order.status || "").toLowerCase() !== "cancelled")
      .map((order) => order.id);

    if (!validOrderIds.length) return [];

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .in("order_id", validOrderIds)
      .not("product_id", "is", null);

    if (itemsError || !items?.length) return [];

    const totals = new Map();
    for (const row of items) {
      const productId = Number(row.product_id);
      if (!Number.isFinite(productId)) continue;
      totals.set(productId, (totals.get(productId) || 0) + (Number(row.quantity) || 1));
    }

    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);
  } catch (err) {
    console.error("Error fetching most ordered product ids:", err);
    return [];
  }
}

/**
 * Fetch upcoming items for the marquee from the database only.
 */
export async function getUpcomingItems() {
  try {
    const { data, error } = await supabase
      .from("upcoming_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not fetch upcoming_items:", error.message);
      return [];
    }

    return (data || []).map((item) => ({
      ...item,
      image: resolveProductImage(item.image, "Oats", item.name),
    }));
  } catch (err) {
    console.warn("Exception fetching upcoming_items:", err);
    return [];
  }
}

const REUSABLE_COUPON_CODES = ["RESERVE10"];
const RESERVE10_MIN_SUBTOTAL = 350;

function isMissingTableError(error, tableName) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST205" ||
    message.includes(`'public.${tableName}'`) ||
    message.includes(`public.${tableName}`) ||
    message.includes(`${tableName}' in the schema cache`)
  );
}

async function allocateOrderNumber() {
  const { data: maxRows, error: maxError } = await supabase
    .from("orders")
    .select("order_number")
    .order("order_number", { ascending: false })
    .limit(1);

  if (maxError) {
    if (isMissingTableError(maxError, "orders") || String(maxError.message || "").includes("order_number")) {
      return null;
    }
    throw maxError;
  }

  let next = 1;
  if (maxRows?.[0]?.order_number != null) {
    next = Number(maxRows[0].order_number) + 1;
  } else {
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "next_order_number")
      .maybeSingle();

    const parsed = parseInt(setting?.value || "1", 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      next = parsed;
    }
  }

  await supabase
    .from("settings")
    .upsert({ key: "next_order_number", value: String(next + 1) }, { onConflict: "key" });

  return next;
}

function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^0-9]/g, "").slice(-10);
}

/**
 * Check whether a customer has already redeemed a coupon/offer code.
 */
export async function hasCustomerUsedCoupon(phone, code) {
  const cleanPhone = normalizePhone(phone);
  const cleanCode = code.trim().toUpperCase();
  if (!cleanPhone || !cleanCode) return false;

  const { data, error } = await supabase
    .from("coupon_redemptions")
    .select("id")
    .eq("customer_phone", cleanPhone)
    .eq("coupon_code", cleanCode)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error, "coupon_redemptions")) return false;
    throw error;
  }

  return Boolean(data);
}

/**
 * Return all coupon/offer codes a customer has already redeemed.
 */
export async function getUsedCouponCodes(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return [];

  const { data, error } = await supabase
    .from("coupon_redemptions")
    .select("coupon_code")
    .eq("customer_phone", cleanPhone);

  if (error) {
    if (isMissingTableError(error, "coupon_redemptions")) return [];
    throw error;
  }

  return data ? data.map((row) => row.coupon_code.toUpperCase()) : [];
}

/**
 * Record a successful coupon redemption for one-time tracking.
 */
export async function recordCouponRedemption(phone, code, orderId) {
  const cleanPhone = normalizePhone(phone);
  const cleanCode = code.trim().toUpperCase();
  if (!cleanPhone || !cleanCode || REUSABLE_COUPON_CODES.includes(cleanCode)) return;

  const { error } = await supabase
    .from("coupon_redemptions")
    .upsert(
      {
        customer_phone: cleanPhone,
        coupon_code: cleanCode,
        order_id: orderId || null,
        redeemed_at: new Date().toISOString()
      },
      { onConflict: "customer_phone,coupon_code" }
    );

  if (error && !isMissingTableError(error, "coupon_redemptions")) {
    throw error;
  }
}

/**
 * Verify if a promotional code is valid for a given customer phone.
 */
export async function verifyAndApplyCoupon(code, phone, orderSubtotal = null) {
  if (!code) {
    return { valid: false, message: "No coupon code provided." };
  }

  const cleanCode = code.trim().toUpperCase();
  const wallet = await getWalletDetails(phone);
  const orderCount = wallet.order_count || 0;

  if (cleanCode.includes("WELCOME") && orderCount > 0) {
    return { valid: false, message: "Welcome coupon is for first-time customers only." };
  }

  if (cleanCode.includes("RESERVE") && cleanCode !== "RESERVE10" && orderCount === 0) {
    return { valid: false, message: "Reserve coupon is for returning customers only." };
  }

  if (cleanCode === "RESERVE10") {
    const sub = orderSubtotal != null ? parseFloat(orderSubtotal) : null;
    if (sub != null && sub < RESERVE10_MIN_SUBTOTAL) {
      return {
        valid: false,
        message: `RESERVE10 gives 10% off when item total is ₹${RESERVE10_MIN_SUBTOTAL} or more.`
      };
    }
  }

  if (!REUSABLE_COUPON_CODES.includes(cleanCode)) {
    const alreadyUsed = await hasCustomerUsedCoupon(phone, cleanCode);
    if (alreadyUsed) {
      return { valid: false, message: "You have already used this offer or coupon." };
    }
  }

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", cleanCode)
    .maybeSingle();

  if (coupon) {
    if (!coupon.is_active) {
      return { valid: false, message: "This coupon code has expired or is inactive." };
    }

    if (coupon.phone_restriction && normalizePhone(coupon.phone_restriction) !== normalizePhone(phone)) {
      return { valid: false, message: "This coupon is restricted to a different customer phone." };
    }

    const minOrderAmount = parseFloat(coupon.min_order_amount || 0);
    const sub = orderSubtotal != null ? parseFloat(orderSubtotal) : null;
    if (minOrderAmount > 0 && sub != null && sub < minOrderAmount) {
      return {
        valid: false,
        message: `${coupon.code} requires a minimum order amount of ₹${minOrderAmount.toFixed(0)}.`
      };
    }

    return {
      valid: true,
      code: coupon.code,
      discount_percent: parseFloat(coupon.discount_percent),
      min_order_amount: minOrderAmount
    };
  }

  return { valid: false, message: "Invalid promotional code." };
}

/**
 * Get wallet coin balance and order count for a guest customer by phone number.
 */
export async function getWalletDetails(phone) {
  if (!phone) return { balance: 0, order_count: 0 };

  const { data, error } = await supabase
    .from("coin_wallet")
    .select("balance, order_count")
    .eq("phone", phone.trim())
    .single();

  if (error || !data) {
    return { balance: 0, order_count: 0 };
  }

  return {
    balance: data.balance || 0,
    order_count: data.order_count || 0
  };
}

/**
 * Set up or update a guest's loyalty coin wallet, increment order count,
 * deduct redeemed coins, and award newly earned order coins.
 */
export async function processWalletTransaction(phone, coinsEarned, coinsRedeemed) {
  const cleanPhone = phone.trim();

  // Fetch existing wallet details
  const { data: wallet, error: fetchError } = await supabase
    .from("coin_wallet")
    .select("*")
    .eq("phone", cleanPhone)
    .single();

  let newBalance = 0;
  let newOrderCount = 1;

  if (fetchError || !wallet) {
    // New guest user wallet creation
    newBalance = Math.max(0, 10 + coinsEarned - coinsRedeemed);
    newOrderCount = 1;

    const { error: insertError } = await supabase
      .from("coin_wallet")
      .insert({
        phone: cleanPhone,
        balance: newBalance,
        order_count: newOrderCount,
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error("Error creating coin wallet:", insertError);
      throw insertError;
    }
  } else {
    // Update existing wallet
    newOrderCount = (wallet.order_count || 0) + 1;
    newBalance = Math.max(0, (wallet.balance || 0) - coinsRedeemed + coinsEarned);

    const { error: updateError } = await supabase
      .from("coin_wallet")
      .update({
        balance: newBalance,
        order_count: newOrderCount,
        updated_at: new Date().toISOString()
      })
      .eq("phone", cleanPhone);

    if (updateError) {
      console.error("Error updating coin wallet:", updateError);
      throw updateError;
    }
  }

  return {
    balance: newBalance,
    order_count: newOrderCount
  };
}

/**
 * Check if the current order triggers the 6th order loyalty discount coupon.
 * If yes, generate and save a coupon code: 6THORDER-XXXX.
 */
export async function checkAndGenerate6thOrderCoupon(phone, newOrderCount) {
  // Fetch settings for order trigger count
  const { data: settingTrigger } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "order_reward_count_trigger")
    .single();

  const { data: settingDiscount } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "reward_coupon_discount")
    .single();

  const triggerCount = settingTrigger ? parseInt(settingTrigger.value, 10) : 6;
  const discountPercent = settingDiscount ? parseFloat(settingDiscount.value) : 15.00;

  // Verify condition
  if (newOrderCount > 0 && newOrderCount % triggerCount === 0) {
    // Generate unique 4 character code suffix
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const couponCode = `6THORDER-${suffix}`;

    const { error: couponError } = await supabase
      .from("coupons")
      .insert({
        code: couponCode,
        discount_percent: discountPercent,
        is_active: true,
        phone_restriction: phone.trim()
      });

    if (couponError) {
      console.error("Failed to insert generated 6th order coupon:", couponError);
      return null;
    }

    return couponCode;
  }

  return null;
}

/**
 * Creates and writes a fully paid order log and order items into the database,
 * process wallet balance modifications, checks loyalty coupon awards,
 * and creates logs for the admin dashboard notifications.
 */
export async function createOrder(orderData, items) {
  const {
    id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    customer_name,
    customer_phone,
    receiver_name,
    receiver_phone,
    delivery_address,
    landmark,
    pincode,
    special_instructions,
    subtotal,
    coin_discount,
    promo_discount,
    tax,
    grand_total,
    coins_earned,
    coupon_code
  } = orderData;

  let mergedInstructions = special_instructions || "";
  if (orderData.delivery_date_time) {
    const scheduleLine = `Scheduled delivery/pickup: ${orderData.delivery_date_time}`;
    mergedInstructions = mergedInstructions
      ? `${mergedInstructions}\n${scheduleLine}`
      : scheduleLine;
  }

  const normalizedCustomerPhone = getPhoneLast10(customer_phone) || String(customer_phone || "").trim();
  const normalizedReceiverPhone = getPhoneLast10(receiver_phone) || String(receiver_phone || "").trim();
  const orderNumber = await allocateOrderNumber();

  const orderPayload = {
    id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    customer_name,
    customer_phone: normalizedCustomerPhone,
    receiver_name,
    receiver_phone: normalizedReceiverPhone,
    delivery_address,
    landmark,
    pincode,
    special_instructions: mergedInstructions,
    subtotal,
    coin_discount: coin_discount || 0.00,
    promo_discount: promo_discount || 0.00,
    tax,
    grand_total,
    coins_earned: coins_earned || 0,
    status: "Pending",
    status_class: "accepted"
  };

  if (orderNumber != null) {
    orderPayload.order_number = orderNumber;
  }

  const { error: orderError } = await supabase.from("orders").insert(orderPayload);

  if (orderError) {
    console.error("Error creating database order:", orderError);
    throw orderError;
  }

  // Upsert user profile on order — save delivery pin as default address when none exists yet
  try {
    const cleanPhone = normalizedCustomerPhone;
    const isTakeaway = isTakeawayAddress(delivery_address);
    const orderHasPinnedDelivery =
      !isTakeaway && hasMapLinkInAddress(delivery_address);

    const { data: existingUser } = await supabase
      .from("user_details")
      .select("delivery_address")
      .eq("phone", cleanPhone)
      .maybeSingle();

    const existingAddress = existingUser?.delivery_address || null;
    const hasSavedPinnedAddress = hasMapLinkInAddress(existingAddress);

    let addressToStore = existingAddress;
    if (orderHasPinnedDelivery && !hasSavedPinnedAddress) {
      addressToStore = delivery_address;
    }

    await supabase
      .from("user_details")
      .upsert({
        phone: cleanPhone,
        customer_name: customer_name,
        delivery_address: addressToStore,
        updated_at: new Date().toISOString()
      });
  } catch (err) {
    console.error("Failsafe warning: Failed to upsert user_details on order creation:", err);
  }

  // Insert order item rows
  const orderItemsData = items.map((item) => ({
    order_id: id,
    product_id: item.id || null,
    name: item.sizeLabel ? `${item.name} (${item.sizeLabel})` : item.name,
    price: item.price,
    quantity: item.quantity,
    selected_addons: item.selectedAddons || []
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsData);

  if (itemsError) {
    console.error("Error inserting order items:", itemsError);
    // Cleanup order record since items failed
    await supabase.from("orders").delete().eq("id", id);
    throw itemsError;
  }

  // Coin calculations
  // Conversion: 1 coin = ₹1.00 discount value
  const coinsRedeemed = Math.round(coin_discount || 0);

  // Update wallet and retrieve counts
  let newOrderCount = 0;
  try {
    const walletResult = await processWalletTransaction(normalizedCustomerPhone, coins_earned, coinsRedeemed);
    newOrderCount = walletResult.order_count;
  } catch (err) {
    console.error("Failsafe warning: wallet modification failed, proceeding with order logging.", err);
  }

  // Check for 6th order reward coupon
  let generatedCoupon = null;
  if (newOrderCount > 0) {
    generatedCoupon = await checkAndGenerate6thOrderCoupon(normalizedCustomerPhone, newOrderCount);
  }

  // Write notification alert logs for active Admin view
  let adminLogMessage = `Order ${formatOrderNumber(orderNumber) || id} created by ${customer_name} (₹${grand_total.toFixed(2)})`;
  if (generatedCoupon) {
    adminLogMessage += `. Loyalty Coupon generated: ${generatedCoupon}`;
  }

  await supabase
    .from("admin_order_logs")
    .insert({
      order_id: id,
      message: adminLogMessage,
      read: false
    });

  if (coupon_code && parseFloat(promo_discount || 0) > 0) {
    try {
      await recordCouponRedemption(normalizedCustomerPhone, coupon_code, id);
    } catch (err) {
      console.error("Failsafe warning: failed to record coupon redemption:", err);
    }
  }

  const displayOrderId = formatOrderNumber(orderNumber);
  try {
    await sendNewOrderAdminEmail(
      {
        id,
        orderNumber,
        displayOrderId,
        customer_name,
        customer_phone: normalizedCustomerPhone,
        receiver_name,
        receiver_phone: normalizedReceiverPhone,
        delivery_address,
        landmark,
        pincode,
        special_instructions: mergedInstructions,
        subtotal,
        coin_discount: coin_discount || 0,
        promo_discount: promo_discount || 0,
        tax,
        grand_total,
      },
      items
    );
  } catch (err) {
    console.error("Failsafe warning: failed to send new-order admin email:", err);
  }

  return {
    orderId: id,
    orderNumber,
    displayOrderId,
    generatedCoupon
  };
}

/**
 * Fetch all orders for the admin dashboard queue.
 */
export async function getAdminOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error retrieving admin orders:", error);
    throw error;
  }

  return data;
}

/**
 * Update the preparation/shipping status of an active kitchen queue order.
 */
export async function updateOrderStatus(orderId, status, statusClass) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status, status_class: statusClass })
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error(`Error updating status for order ${orderId}:`, error);
    throw error;
  }

  // Log update message
  await supabase
    .from("admin_order_logs")
    .insert({
      order_id: orderId,
      message: `Order status for ${orderId} updated to '${status}'.`,
      read: false
    });

  return data;
}

/**
 * Fetch logs for admin alert systems.
 */
export async function getAdminLogs() {
  const { data, error } = await supabase
    .from("admin_order_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Error retrieving admin activity logs:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new product.
 */
export async function createProduct(product) {
  const {
    category_id,
    name,
    price,
    calories,
    rating,
    description,
    image,
    in_stock,
    quantity,
    subCategory,
    sizePricesRaw,
    sizeGramsRaw,
    sizeCaloriesRaw,
    protein,
    carbohydrates,
    fats,
    ingredients,
    serving_size,
    serving_weight_g,
    total_weight_g,
    saturated_fat,
    sugar,
    dietary_fibre,
    sodium_mg,
    show_in_menu,
  } = product;

  const sizes = parseSizePrices(sizePricesRaw, price);
  const safeCalories =
    calories === "" || calories == null || Number.isNaN(Number(calories))
      ? 0
      : Math.round(Number(calories));
  const finalDescription = buildDescriptionWithMeta(
    description,
    subCategory,
    sizePricesRaw,
    sizeGramsRaw,
    sizeCaloriesRaw
  );

  const { data, error } = await supabase
    .from("products")
    .insert({
      category_id,
      name,
      price: sizes[0]?.price ?? (Number.isFinite(Number(price)) ? Number(price) : 0),
      calories: safeCalories,
      rating: rating == null || rating === "" ? 4.8 : rating,
      description: finalDescription,
      image,
      in_stock: in_stock !== false,
      quantity: quantity != null && quantity !== "" ? parseInt(quantity, 10) : 100,
      protein: protein === "" || protein == null ? null : Number(protein),
      carbohydrates: carbohydrates === "" || carbohydrates == null ? null : Number(carbohydrates),
      fats: fats === "" || fats == null ? null : Number(fats),
      ingredients: ingredients || null,
      serving_size: serving_size === "" || serving_size == null ? null : Number(serving_size),
      serving_weight_g:
        serving_weight_g === "" || serving_weight_g == null ? null : Number(serving_weight_g),
      total_weight_g:
        total_weight_g === "" || total_weight_g == null ? null : Number(total_weight_g),
      saturated_fat: saturated_fat === "" || saturated_fat == null ? null : Number(saturated_fat),
      sugar: sugar === "" || sugar == null ? null : Number(sugar),
      dietary_fibre: dietary_fibre === "" || dietary_fibre == null ? null : Number(dietary_fibre),
      sodium_mg: sodium_mg === "" || sodium_mg == null ? null : Number(sodium_mg),
      show_in_menu: show_in_menu !== false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update product details.
 */
export async function updateProduct(id, product) {
  const {
    category_id,
    name,
    price,
    calories,
    rating,
    description,
    image,
    in_stock,
    quantity,
    subCategory,
    sizePricesRaw,
    sizeGramsRaw,
    sizeCaloriesRaw,
    protein,
    carbohydrates,
    fats,
    ingredients,
    serving_size,
    serving_weight_g,
    total_weight_g,
    saturated_fat,
    sugar,
    dietary_fibre,
    sodium_mg,
    show_in_menu,
  } = product;

  // Empty string clears size_prices. null/undefined → keep existing on update.
  // Same for grams/calories: only restore when the field was omitted (undefined),
  // not when admin intentionally sent "".
  let resolvedSizeRaw = sizePricesRaw == null ? undefined : String(sizePricesRaw);
  let resolvedGramsRaw = sizeGramsRaw === undefined ? undefined : sizeGramsRaw;
  let resolvedCaloriesRaw = sizeCaloriesRaw === undefined ? undefined : sizeCaloriesRaw;
  let resolvedSubCategory = subCategory;

  const needsMetaLookup =
    resolvedSizeRaw === undefined ||
    resolvedGramsRaw === undefined ||
    resolvedCaloriesRaw === undefined ||
    !resolvedSubCategory;

  if (needsMetaLookup) {
    const { data: existing, error: existingError } = await supabase
      .from("products")
      .select("description")
      .eq("id", id)
      .single();
    if (existingError) throw existingError;
    const parsed = parseDescriptionParts(existing?.description || "");
    if (resolvedSizeRaw === undefined) resolvedSizeRaw = parsed.sizePricesRaw;
    if (resolvedGramsRaw === undefined) resolvedGramsRaw = parsed.sizeGramsRaw;
    if (resolvedCaloriesRaw === undefined) resolvedCaloriesRaw = parsed.sizeCaloriesRaw;
    if (!resolvedSubCategory) {
      resolvedSubCategory = parsed.subCategory || "regular";
    }
  }

  resolvedSizeRaw = resolvedSizeRaw || "";
  resolvedGramsRaw = resolvedGramsRaw || "";
  resolvedCaloriesRaw = resolvedCaloriesRaw || "";
  const sizes = parseSizePrices(resolvedSizeRaw, price);
  const safeCalories =
    calories === "" || calories == null || Number.isNaN(Number(calories))
      ? null
      : Math.round(Number(calories));
  const finalDescription = buildDescriptionWithMeta(
    description,
    resolvedSubCategory || "regular",
    resolvedSizeRaw,
    resolvedGramsRaw,
    resolvedCaloriesRaw
  );

  const updatePayload = {
    category_id,
    name,
    price: sizes[0]?.price ?? (Number.isFinite(Number(price)) ? Number(price) : 0),
    calories: safeCalories,
    rating: rating == null || rating === "" ? 4.8 : rating,
    description: finalDescription,
    image,
    in_stock,
  };

  // Patch-style optional fields: only write when the caller provided them.
  if (protein !== undefined) {
    updatePayload.protein = protein === "" || protein == null ? null : Number(protein);
  }
  if (carbohydrates !== undefined) {
    updatePayload.carbohydrates =
      carbohydrates === "" || carbohydrates == null ? null : Number(carbohydrates);
  }
  if (fats !== undefined) {
    updatePayload.fats = fats === "" || fats == null ? null : Number(fats);
  }
  if (ingredients !== undefined) {
    updatePayload.ingredients = ingredients || null;
  }
  if (serving_size !== undefined) {
    updatePayload.serving_size =
      serving_size === "" || serving_size == null ? null : Number(serving_size);
  }
  if (serving_weight_g !== undefined) {
    updatePayload.serving_weight_g =
      serving_weight_g === "" || serving_weight_g == null ? null : Number(serving_weight_g);
  }
  if (total_weight_g !== undefined) {
    updatePayload.total_weight_g =
      total_weight_g === "" || total_weight_g == null ? null : Number(total_weight_g);
  }
  if (saturated_fat !== undefined) {
    updatePayload.saturated_fat =
      saturated_fat === "" || saturated_fat == null ? null : Number(saturated_fat);
  }
  if (sugar !== undefined) {
    updatePayload.sugar = sugar === "" || sugar == null ? null : Number(sugar);
  }
  if (dietary_fibre !== undefined) {
    updatePayload.dietary_fibre =
      dietary_fibre === "" || dietary_fibre == null ? null : Number(dietary_fibre);
  }
  if (sodium_mg !== undefined) {
    updatePayload.sodium_mg = sodium_mg === "" || sodium_mg == null ? null : Number(sodium_mg);
  }

  if (quantity != null && quantity !== "") {
    updatePayload.quantity = parseInt(quantity, 10);
  }
  if (typeof show_in_menu === "boolean") {
    updatePayload.show_in_menu = show_in_menu;
  }

  const { data, error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Stock-only update — never touches nutrition / description / prices.
 */
export async function updateProductStock(id, in_stock, quantity) {
  const updatePayload = {
    in_stock: Boolean(in_stock),
  };

  if (quantity != null && quantity !== "") {
    updatePayload.quantity = parseInt(quantity, 10);
  } else if (in_stock) {
    // Restocking: ensure storefront inStock (qty must be null or > 0).
    updatePayload.quantity = 100;
  } else {
    updatePayload.quantity = 0;
  }

  const { data, error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle whether a product appears on the storefront menu.
 */
export async function updateProductVisibility(id, show_in_menu) {
  if (typeof show_in_menu !== "boolean") {
    throw new Error("show_in_menu must be a boolean.");
  }
  const { data, error } = await supabase
    .from("products")
    .update({ show_in_menu })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a product.
 */
export async function deleteProduct(id) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Create a new category.
 */
export async function createCategory(category) {
  const { name, show_in_menu = true, show_section = false } = category;
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name,
      show_in_menu: show_in_menu !== false,
      show_section: Boolean(show_section),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update category details.
 */
export async function updateCategory(id, category) {
  const patch = {};
  if (category.name != null) patch.name = category.name;
  if (category.show_in_menu != null) patch.show_in_menu = Boolean(category.show_in_menu);
  if (category.show_section != null) patch.show_section = Boolean(category.show_section);

  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle category storefront visibility flags.
 */
export async function updateCategoryVisibility(
  id,
  { show_in_menu, show_section, show_calories, show_grams, show_ingredients, show_nutrients } = {}
) {
  const patch = {};
  if (typeof show_in_menu === "boolean") patch.show_in_menu = show_in_menu;
  if (typeof show_section === "boolean") patch.show_section = show_section;
  if (typeof show_calories === "boolean") patch.show_calories = show_calories;
  if (typeof show_grams === "boolean") patch.show_grams = show_grams;
  if (typeof show_ingredients === "boolean") patch.show_ingredients = show_ingredients;
  if (typeof show_nutrients === "boolean") patch.show_nutrients = show_nutrients;
  // Show Menu OFF ⇒ Category Title must also be OFF
  if (patch.show_in_menu === false) {
    patch.show_section = false;
  }
  if (!Object.keys(patch).length) {
    throw new Error("No visibility fields provided.");
  }

  // Title ON is only valid while Menu is ON
  if (patch.show_section === true && patch.show_in_menu !== true) {
    const { data: current, error: currentError } = await supabase
      .from("categories")
      .select("show_in_menu")
      .eq("id", id)
      .single();
    if (currentError) throw currentError;
    if (current?.show_in_menu === false) {
      patch.show_section = false;
    }
  }

  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Categories for customer menu tabs / featured sections.
 */
export async function getMenuCategories() {
  if (!supabase) {
    throw new Error("Database is not configured. Check SUPABASE env vars.");
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, show_in_menu, show_section, show_calories, show_grams, show_ingredients, show_nutrients, created_at")
    .order("id", { ascending: true });

  if (error) throw error;

  return (data || []).map((category) => ({
    id: category.id,
    name: normalizeMenuCategory(category.name),
    rawName: category.name,
    showInMenu: category.show_in_menu !== false,
    showSection: Boolean(category.show_section),
    showCalories: category.show_calories !== false,
    showGrams: category.show_grams !== false,
    showIngredients: category.show_ingredients !== false,
    showNutrients: category.show_nutrients !== false,
  }));
}

/**
 * Delete a category.
 */
export async function deleteCategory(id) {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Create a product addon.
 */
export async function createAddon(addon) {
  const { category_id, name, price, calories, grams, is_active } = addon;
  const resolvedCalories = calories ?? lookupAddonCalories(name) ?? null;
  const resolvedGrams = grams != null && grams !== "" ? parseInt(grams, 10) : 30;
  const { data, error } = await supabase
    .from("product_addons")
    .insert({
      category_id,
      name,
      price,
      calories: resolvedCalories,
      grams: Number.isFinite(resolvedGrams) && resolvedGrams > 0 ? resolvedGrams : 30,
      is_active: is_active !== false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a product addon.
 */
export async function updateAddon(id, addon) {
  const { category_id, name, price, calories, grams, is_active } = addon;
  const resolvedCalories = calories ?? lookupAddonCalories(name) ?? null;
  const payload = { category_id, name, price, calories: resolvedCalories };
  if (grams != null && grams !== "") {
    const resolvedGrams = parseInt(grams, 10);
    payload.grams = Number.isFinite(resolvedGrams) && resolvedGrams > 0 ? resolvedGrams : 30;
  } else {
    payload.grams = 30;
  }
  if (typeof is_active === "boolean") {
    payload.is_active = is_active;
  }
  const { data, error } = await supabase
    .from("product_addons")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Toggle whether an addon appears on the storefront.
 */
export async function updateAddonVisibility(id, is_active) {
  if (typeof is_active !== "boolean") {
    throw new Error("is_active must be a boolean.");
  }
  const { data, error } = await supabase
    .from("product_addons")
    .update({ is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a product addon.
 */
export async function deleteAddon(id) {
  const { error } = await supabase
    .from("product_addons")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Create a coupon code.
 */
export async function createCoupon(coupon) {
  const { code, discount_percent, is_active, phone_restriction, min_order_amount } = coupon;
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: code.trim().toUpperCase(),
      discount_percent,
      is_active: is_active !== false,
      phone_restriction: phone_restriction || null,
      min_order_amount: parseFloat(min_order_amount || 0)
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a coupon code.
 */
export async function updateCoupon(code, coupon) {
  const originalCode = String(code || "").trim().toUpperCase();
  const {
    code: nextCodeRaw,
    discount_percent,
    is_active,
    phone_restriction,
    min_order_amount
  } = coupon;
  const nextCode = String(nextCodeRaw || originalCode).trim().toUpperCase();

  if (!originalCode) {
    throw new Error("Coupon code is required.");
  }

  if (!nextCode) {
    throw new Error("Coupon name/code cannot be empty.");
  }

  const { data: existingCoupon, error: fetchError } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", originalCode)
    .single();

  if (fetchError) throw fetchError;

  if (nextCode !== originalCode) {
    const { data: duplicateCoupon, error: duplicateError } = await supabase
      .from("coupons")
      .select("code")
      .eq("code", nextCode)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicateCoupon) {
      throw new Error(`Coupon code "${nextCode}" already exists.`);
    }

    const { error: redemptionError } = await supabase
      .from("coupon_redemptions")
      .update({ coupon_code: nextCode })
      .eq("coupon_code", originalCode);

    if (redemptionError && !isMissingTableError(redemptionError, "coupon_redemptions")) {
      throw redemptionError;
    }

    const { error: deleteError } = await supabase
      .from("coupons")
      .delete()
      .eq("code", originalCode);

    if (deleteError) throw deleteError;

    const { data, error: insertError } = await supabase
      .from("coupons")
      .insert({
        code: nextCode,
        discount_percent: discount_percent ?? existingCoupon.discount_percent,
        is_active: is_active !== false,
        phone_restriction: phone_restriction || null,
        min_order_amount: parseFloat(min_order_amount ?? existingCoupon.min_order_amount ?? 0)
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return data;
  }

  const { data, error } = await supabase
    .from("coupons")
    .update({
      discount_percent,
      is_active,
      phone_restriction: phone_restriction || null,
      min_order_amount: parseFloat(min_order_amount ?? 0)
    })
    .eq("code", originalCode)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a coupon code.
 */
export async function deleteCoupon(code) {
  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("code", code.trim().toUpperCase());

  if (error) throw error;
  return { success: true };
}

/**
 * Adjust wallet coins balance for a customer.
 */
export async function adjustWalletCoins(phone, actionType, amount) {
  const cleanPhone = phone.trim();
  const { data: wallet } = await supabase
    .from("coin_wallet")
    .select("*")
    .eq("phone", cleanPhone)
    .maybeSingle();

  let currentBalance = 0;
  let orderCount = 0;

  if (wallet) {
    currentBalance = wallet.balance || 0;
    orderCount = wallet.order_count || 0;
  }

  let newBalance = 0;
  if (actionType === "add") {
    newBalance = currentBalance + amount;
  } else if (actionType === "remove") {
    newBalance = Math.max(0, currentBalance - amount);
  } else if (actionType === "reset") {
    newBalance = 0;
  }

  const payload = {
    phone: cleanPhone,
    balance: newBalance,
    order_count: orderCount,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("coin_wallet")
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update global system settings.
 */
export async function updateSettings(settingsList) {
  const promises = Object.entries(settingsList).map(async ([key, value]) => {
    const stringValue = String(value);
    const { data, error } = await supabase
      .from("settings")
      .update({ value: stringValue })
      .eq("key", key)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      const { error: insError } = await supabase
        .from("settings")
        .insert({ key, value: stringValue });
      if (insError) throw insError;
    }
  });

  await Promise.all(promises);
  return { success: true };
}

/**
 * Retrieve all store & business updates.
 */
export async function getUpdates() {
  const { data, error } = await supabase
    .from("business_updates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching updates:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Create a new store & business update.
 */
export async function createUpdate(updateData) {
  const { title, subtitle, content, tag, image_url } = updateData;
  const { data, error } = await supabase
    .from("business_updates")
    .insert({
      title,
      subtitle,
      content,
      tag: tag || "New Store",
      image_url: image_url || "/masala_oats.png"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing store & business update.
 */
export async function updateUpdate(id, updateData) {
  const { title, subtitle, content, tag, image_url } = updateData;
  const { data, error } = await supabase
    .from("business_updates")
    .update({
      title,
      subtitle,
      content,
      tag,
      image_url
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a store & business update.
 */
export async function deleteUpdate(id) {
  const { error } = await supabase
    .from("business_updates")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Retrieve all events.
 */
export async function getEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Create a new event.
 */
export async function createEvent(eventData) {
  const { title, location, event_date, description, requires_registration, image_url } = eventData;
  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      location,
      event_date,
      description,
      requires_registration: !!requires_registration,
      image_url: image_url || "/south_indian_upma.png"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing event.
 */
export async function updateEvent(id, eventData) {
  const { title, location, event_date, description, requires_registration, image_url } = eventData;
  const { data, error } = await supabase
    .from("events")
    .update({
      title,
      location,
      event_date,
      description,
      requires_registration: !!requires_registration,
      image_url
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an event.
 */
export async function deleteEvent(id) {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Create an upcoming item.
 */
export async function createUpcomingItem(item) {
  const { name, description, image } = item;
  const { data, error } = await supabase
    .from("upcoming_items")
    .insert({ name, description, image })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an upcoming item.
 */
export async function updateUpcomingItem(id, item) {
  const { name, description, image } = item;
  const { data, error } = await supabase
    .from("upcoming_items")
    .update({ name, description, image })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an upcoming item.
 */
export async function deleteUpcomingItem(id) {
  const { error } = await supabase
    .from("upcoming_items")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Delete a guest inquiry / contact submission.
 */
export async function deleteContactSubmission(id) {
  const { error } = await supabase
    .from("contact_submissions")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * Register a guest for an event.
 */
export async function registerForEvent(eventId, guestData) {
  const { user_name, user_phone, user_email } = guestData;
  const { data, error } = await supabase
    .from("event_registrations")
    .insert({
      event_id: parseInt(eventId, 10),
      user_name,
      user_phone: user_phone.trim(),
      user_email: user_email ? user_email.trim() : null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Retrieve registrations for a specific event.
 */
export async function getEventRegistrations(eventId) {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("event_id", parseInt(eventId, 10))
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching event registrations:", error.message);
    return [];
  }
  return data || [];
}
