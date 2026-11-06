import { NextResponse } from "next/server";
import { lookupAddonCalories } from "@/app/lib/addonCalories";
import { formatOrderItemSummary } from "@/app/lib/cartDisplay";
import { supabase } from "@/app/lib/supabaseClient";
import {
  parseDescriptionParts,
  parseSizePrices,
  extractSizePricesRaw,
  extractSizeGramsRaw,
  extractSizeCaloriesRaw,
  filterPricedSizes,
} from "@/app/lib/productSizes";
import { enrichSizesWithCalories } from "@/app/lib/productCalories";
import { enrichSizesWithPortions } from "@/app/lib/productPortions";
import { normalizeProfileAddress } from "@/app/lib/profileAddress";
import { isAdminAuthenticated } from "@/app/lib/adminAuth";
import { getSectionFetchNeeds, pickSectionPayload } from "@/app/lib/adminSyncSections";
import { resolveDateRangeBounds, getQueryTimestampBounds } from "@/app/lib/adminDateRange";
import { formatOrderNumber } from "@/app/lib/orderNumber";
import { getTodayDateKey, formatAdminDateTime, formatAdminDateLabel, ADMIN_TIMEZONE } from "@/app/lib/dates";
import { parsePickupTable, buildOrderEnjoyDetails } from "@/app/lib/orderEnjoyDetails";
import {
  updateOrderStatus,
  getAdminLogs,
  createProduct,
  updateProduct,
  updateProductStock,
  updateProductVisibility,
  deleteProduct,
  createCategory,
  updateCategory,
  updateCategoryVisibility,
  deleteCategory,
  createAddon,
  updateAddon,
  updateAddonVisibility,
  deleteAddon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  adjustWalletCoins,
  updateSettings,
  createUpdate,
  updateUpdate,
  deleteUpdate,
  createEvent,
  updateEvent,
  deleteEvent,
  createUpcomingItem,
  updateUpcomingItem,
  deleteUpcomingItem,
  deleteContactSubmission,
  getEventRegistrations
} from "@/app/lib/dbService";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const section = new URL(request.url).searchParams.get("section") || "all";
    const dateFromParam = new URL(request.url).searchParams.get("dateFrom");
    const dateToParam = new URL(request.url).searchParams.get("dateTo");
    const dateBounds = resolveDateRangeBounds({
      preset: dateFromParam || dateToParam ? "custom" : "all",
      from: dateFromParam || "",
      to: dateToParam || ""
    });
    const hasDateRange = Boolean(dateBounds.from && dateBounds.to);
    const queryTimestamps = hasDateRange ? getQueryTimestampBounds(dateBounds) : null;
    const need = getSectionFetchNeeds(section);

    // Fetch user_details when building customer records
    let userDetailsMap = {};
    if (need.userDetails) {
      try {
        const { data: udRows, error: udError } = await supabase
          .from("user_details")
          .select("phone, customer_name, delivery_address");
        if (!udError && udRows) {
          udRows.forEach((u) => {
            userDetailsMap[u.phone] = {
              name: u.customer_name,
              address: normalizeProfileAddress(u.delivery_address)
            };
          });
        }
      } catch (_) {
        // user_details table not available
      }
    }

    const empty = { data: [], error: null };

    const fetchOrders = async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .not("id", "ilike", "PROFILE-%")
        .order("created_at", { ascending: false });

      return query;
    };

    const [
      ordersRes,
      categoriesRes,
      productsRes,
      addonsRes,
      couponsRes,
      walletsRes,
      settingsRes,
      logsRes,
      updatesRes,
      eventsRes
    ] = await Promise.all([
      need.orders ? fetchOrders() : Promise.resolve(empty),
      need.categories
        ? supabase.from("categories").select("*").order("id", { ascending: true })
        : Promise.resolve(empty),
      need.products
        ? supabase.from("products").select("*, categories(name)").order("id", { ascending: true })
        : Promise.resolve(empty),
      need.addons
        ? supabase
            .from("product_addons")
            .select("*, categories(id, name)")
            .order("id", { ascending: true })
        : Promise.resolve(empty),
      need.coupons
        ? supabase.from("coupons").select("*").order("created_at", { ascending: false })
        : Promise.resolve(empty),
      need.wallets
        ? supabase.from("coin_wallet").select("*")
        : Promise.resolve(empty),
      need.settings
        ? supabase.from("settings").select("*")
        : Promise.resolve(empty),
      need.logs
        ? supabase.from("admin_order_logs").select("*").order("created_at", { ascending: false }).limit(30)
        : Promise.resolve(empty),
      need.updates
        ? supabase.from("business_updates").select("*").order("created_at", { ascending: false })
        : Promise.resolve(empty),
      need.events
        ? supabase.from("events").select("*").order("event_date", { ascending: true })
        : Promise.resolve(empty)
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (productsRes.error) throw productsRes.error;
    if (addonsRes.error) throw addonsRes.error;
    if (couponsRes.error) throw couponsRes.error;
    if (walletsRes.error) throw walletsRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (logsRes.error) throw logsRes.error;

    const allOrders = ordersRes.data || [];
    const orders = allOrders.filter((o) => !String(o.id || "").startsWith("PROFILE-"));
    const categories = categoriesRes.data || [];
    
    // Map products list to display nested categories name and parse subCategory
    const products = (productsRes.data || []).map(p => {
      const { cleanDescription, subCategory, sizePricesRaw, sizeGramsRaw, sizeCaloriesRaw } =
        parseDescriptionParts(p.description || "");
      const sizes = filterPricedSizes(
        enrichSizesWithPortions(
          enrichSizesWithCalories(
            parseSizePrices(sizePricesRaw, p.price),
            p.calories,
            sizeCaloriesRaw
          ),
          p.calories,
          sizeGramsRaw
        )
      );
      return {
        ...p,
        description: cleanDescription,
        subCategory,
        sizePricesRaw: sizePricesRaw || extractSizePricesRaw(p.description || ""),
        sizeGramsRaw: sizeGramsRaw || extractSizeGramsRaw(p.description || ""),
        sizeCaloriesRaw: sizeCaloriesRaw || extractSizeCaloriesRaw(p.description || ""),
        sizes,
        categoryName: p.categories?.name || "Sushi",
        show_in_menu: p.show_in_menu !== false,
      };
    });
    
    const addons = (addonsRes.data || [])
      .map((addon) => ({
        ...addon,
        categoryName: addon.categories?.name || null,
        category_id: addon.category_id,
        is_active: addon.is_active !== false,
      }))
      .sort((a, b) => {
        const catA = String(a.categoryName || "").toLowerCase();
        const catB = String(b.categoryName || "").toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    const coupons = couponsRes.data || [];
    const wallets = walletsRes.data || [];
    const settingsList = settingsRes.data || [];
    const logs = logsRes.data || [];

    // Format settings map
    const settings = {};
    settingsList.forEach((s) => {
      settings[s.key] = s.value;
    });

    // 2. Compute Dashboard Statistics
    const todayKey = getTodayDateKey(ADMIN_TIMEZONE);
    const startOfToday = new Date(`${todayKey}T00:00:00.000+05:30`).getTime();

    // Filter orders for the selected date range to calculate range-specific stats
    let rangeOrders = orders;
    if (queryTimestamps) {
      const fromTime = new Date(queryTimestamps.from).getTime();
      const toTime = new Date(queryTimestamps.to).getTime();
      rangeOrders = orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= fromTime && t <= toTime;
      });
    }

    const isCancelledOrderStatus = (status) => (status || "").toLowerCase() === "cancelled";

    const rangeRevenueOrders = rangeOrders.filter((o) => !isCancelledOrderStatus(o.status));

    const todayRevenue = rangeRevenueOrders.reduce((sum, o) => sum + parseFloat(o.grand_total || 0), 0);
    const todayCoinsIssued = rangeRevenueOrders.reduce((sum, o) => sum + (o.coins_earned || 0), 0);
    const todayCustomers = new Set(rangeRevenueOrders.map((o) => o.customer_phone)).size;

    const revenueOrders = orders.filter((o) => !isCancelledOrderStatus(o.status));
    const totalOrders = revenueOrders.length;
    const totalRevenue = revenueOrders.reduce((sum, o) => sum + parseFloat(o.grand_total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalCoinsAwarded = revenueOrders.reduce((sum, o) => sum + (o.coins_earned || 0), 0);

    const isPendingOrderStatus = (status) => {
      const s = (status || "").toLowerCase();
      return s !== "delivered & plated" && s !== "delivered" && s !== "cancelled";
    };

    const pendingOrdersCount = rangeOrders.filter((o) => isPendingOrderStatus(o.status)).length;
    const preparingOrdersCount = rangeOrders.filter(
      (o) => o.status === "Culinary Preparation" || o.status === "Preparing"
    ).length;
    const deliveredOrdersCount = rangeOrders.filter(
      (o) => o.status === "Delivered & Plated" || o.status === "Delivered"
    ).length;
    const cancelledOrdersCount = rangeOrders.filter((o) => isCancelledOrderStatus(o.status)).length;

    const stats = {
      todayRevenue: parseFloat(todayRevenue.toFixed(2)),
      todayOrdersCount: rangeRevenueOrders.length,
      pendingOrdersCount,
      preparingOrdersCount,
      deliveredOrdersCount,
      cancelledOrdersCount,
      todayCustomersCount: todayCustomers,
      todayCoinsIssued,
      isRangeFiltered: hasDateRange,
      dateRange: {
        from: dateBounds.from,
        to: dateBounds.to,
        label: !dateBounds.from
          ? "All Time"
          : dateBounds.from === dateBounds.to
            ? formatAdminDateLabel(dateBounds.from)
            : `${formatAdminDateLabel(dateBounds.from)} → ${formatAdminDateLabel(dateBounds.to)}`
      },

      // Total metrics (within fetched scope)
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      totalCoinsAwarded
    };

    // 3. Consolidated Customers Table
    const customerMap = {};

    if (!hasDateRange) {
      wallets.forEach((w) => {
        const ud = userDetailsMap[w.phone];
        customerMap[w.phone] = {
          phone: w.phone,
          name: ud?.name || "Lounge Guest",
          profileAddress: ud?.address || null,
          ordersCount: w.order_count || 0,
          totalSpend: 0,
          coinsBalance: w.balance || 0,
          couponsUsed: 0,
          lastOrderDate: null
        };
      });
    } else {
      wallets.forEach((w) => {
        const ud = userDetailsMap[w.phone];
        customerMap[w.phone] = {
          phone: w.phone,
          name: ud?.name || "Lounge Guest",
          profileAddress: ud?.address || null,
          ordersCount: 0,
          totalSpend: 0,
          coinsBalance: w.balance || 0,
          couponsUsed: 0,
          lastOrderDate: null
        };
      });
    }

    // PROFILE- stubs are no longer used; customers come from user_details + real orders only.

    // Regular orders: only update stats — never touch name/address
    rangeOrders.forEach((ord) => {
      const phone = ord.customer_phone;
      if (!customerMap[phone]) {
        const ud = userDetailsMap[phone];
        customerMap[phone] = {
          phone,
          name: ud?.name || ord.customer_name,
          profileAddress: ud?.address || null,
          ordersCount: 0,
          totalSpend: 0,
          coinsBalance: 0,
          couponsUsed: 0,
          lastOrderDate: null
        };
      }
      if (isCancelledOrderStatus(ord.status)) return;
      const c = customerMap[phone];
      c.ordersCount += 1;
      c.totalSpend += parseFloat(ord.grand_total || 0);
      const ordTime = new Date(ord.created_at).getTime();
      if (!c.lastOrderDate || ordTime > new Date(c.lastOrderDate).getTime()) {
        c.lastOrderDate = ord.created_at;
      }
    });

    const customers = Object.values(customerMap)
      .filter((c) => !hasDateRange || c.ordersCount > 0)
      .map((c) => ({
        ...c,
        address: c.profileAddress || "Not added",
        totalSpend: parseFloat(c.totalSpend.toFixed(2))
      }));

    // 4. Consolidated Payments Table
    const payments = rangeOrders.map((ord) => ({
      paymentId: ord.razorpay_payment_id || `MOCK_PAY_${ord.id}`,
      orderId: formatOrderNumber(ord.order_number) || ord.id,
      amount: parseFloat(ord.grand_total || 0),
      method: "Razorpay Gateway",
      status: ord.razorpay_signature ? "Paid" : "Pending",
      date: ord.created_at,
      customerName: ord.customer_name,
      customerPhone: ord.customer_phone
    }));

    // 5. Format kitchen orders queue list (include items array as well)
    let formattedOrders = rangeOrders.map((order) => {
      const itemsString = order.order_items
        ? order.order_items.map((item) => formatOrderItemSummary(item)).join(", ")
        : "No items";

      const baseOrder = {
        id: order.id,
        orderNumber: order.order_number ?? null,
        displayOrderId: formatOrderNumber(order.order_number),
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        receiverName: order.receiver_name,
        receiverPhone: order.receiver_phone,
        landmark: order.landmark || "",
        pincode: order.pincode,
        specialInstructions: order.special_instructions || "",
        deliveryDateTime: order.delivery_date_time || "",
        preferredPickupTime: parsePickupTable(order.delivery_address || ""),
        tableNo: parsePickupTable(order.delivery_address || ""),
        subtotal: parseFloat(order.subtotal || 0),
        coinDiscount: parseFloat(order.coin_discount || 0),
        promoDiscount: parseFloat(order.promo_discount || 0),
        couponCode: order.coupon_code || "",
        promoCode: order.coupon_code || "",
        tax: parseFloat(order.tax || 0),
        packingFee: order.packing_fee != null ? parseFloat(order.packing_fee) : undefined,
        deliveryFee: order.delivery_fee != null ? parseFloat(order.delivery_fee) : undefined,
        grandTotal: parseFloat(order.grand_total || 0),
        coinsEarned: order.coins_earned || 0,
        items: itemsString,
        itemsList: order.order_items || [],
        location: order.delivery_address,
        deliveryAddress: order.delivery_address,
        status: order.status,
        statusClass: order.status_class,
        createdAt: order.created_at,
        date: formatAdminDateTime(order.created_at),
      };

      const details = buildOrderEnjoyDetails(baseOrder, settings);
      return {
        ...baseOrder,
        packingFee: details.packingFee,
        deliveryFee: details.deliveryFee,
        distanceKm: details.distanceKm,
        gstPercent: details.gstPercent,
        diningMode: details.diningMode
      };
    });

    let updates = [];
    if (need.updates) {
      if (updatesRes && !updatesRes.error) {
        updates = updatesRes.data || [];
      } else {
        console.warn("Failsafe: business_updates table not available:", updatesRes?.error?.message);
      }
    }

    let events = [];
    if (need.events) {
      if (eventsRes && !eventsRes.error) {
        events = eventsRes.data || [];
      } else {
        console.warn("Failsafe: events table not available:", eventsRes?.error?.message);
      }
    }

    // Safely fetch upcoming_items with fallback
    let upcomingItems = [];
    if (need.upcoming) {
      try {
        const { data: upcomingData, error: upcomingError } = await supabase
          .from("upcoming_items")
          .select("*")
          .order("created_at", { ascending: false });
        if (!upcomingError && upcomingData) {
          upcomingItems = upcomingData;
        }
      } catch (e) {
        console.warn("Upcoming items failsafe", e);
      }
    }

    // Safely fetch contact submissions with fallback
    let contacts = [];
    if (need.contacts) {
      try {
        const { data: contactsData, error: contactsError } = await supabase
          .from("contact_submissions")
          .select("*")
          .order("created_at", { ascending: false });
        if (!contactsError && contactsData) {
          contacts = contactsData;
        }
      } catch (e) {
        console.warn("Contact submissions failsafe", e);
      }
    }

    const fullPayload = {
      success: true,
      stats,
      orders: formattedOrders,
      categories,
      products,
      addons,
      coupons,
      customers,
      payments,
      settings,
      logs,
      updates,
      events,
      upcomingItems,
      contacts
    };

    return NextResponse.json(pickSectionPayload(section, fullPayload));

  } catch (error) {
    console.error("Error retrieving admin details:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: "Action is required." }, { status: 400 });
    }

    let result;

    switch (action) {
      case "update-order-status": {
        const { orderId, status, statusClass } = body;
        result = await updateOrderStatus(orderId, status, statusClass);
        break;
      }
      case "product-create": {
        result = await createProduct(body.product);
        break;
      }
      case "product-update": {
        result = await updateProduct(body.id, body.product);
        break;
      }
      case "product-stock": {
        result = await updateProductStock(
          body.id,
          Boolean(body.in_stock),
          body.quantity
        );
        break;
      }
      case "product-delete": {
        result = await deleteProduct(body.id);
        break;
      }
      case "product-visibility": {
        result = await updateProductVisibility(body.id, Boolean(body.show_in_menu));
        break;
      }
      case "category-create": {
        result = await createCategory(body.category);
        break;
      }
      case "category-update": {
        result = await updateCategory(body.id, body.category);
        break;
      }
      case "category-visibility": {
        result = await updateCategoryVisibility(body.id, {
          show_in_menu: body.show_in_menu,
          show_section: body.show_section,
          show_calories: body.show_calories,
          show_grams: body.show_grams,
          show_ingredients: body.show_ingredients,
          show_nutrients: body.show_nutrients,
        });
        break;
      }
      case "category-delete": {
        result = await deleteCategory(body.id);
        break;
      }
      case "addon-create": {
        if (body.addon.category_id === "all") {
          const { data: allCats, error: catError } = await supabase.from("categories").select("id");
          if (catError) throw catError;
          const resolvedCalories = body.addon.calories ?? lookupAddonCalories(body.addon.name) ?? null;
          const resolvedGrams = body.addon.grams != null && body.addon.grams !== ""
            ? parseInt(body.addon.grams, 10)
            : 30;
          const inserts = allCats.map(c => ({
            category_id: c.id,
            name: body.addon.name,
            price: body.addon.price,
            calories: resolvedCalories,
            grams: Number.isFinite(resolvedGrams) && resolvedGrams > 0 ? resolvedGrams : 30
          }));
          const { error } = await supabase.from("product_addons").insert(inserts);
          if (error) throw error;
          result = { success: true };
        } else {
          result = await createAddon(body.addon);
        }
        break;
      }
      case "addon-update": {
        if (body.ids && Array.isArray(body.ids)) {
          const resolvedGrams = body.addon.grams != null && body.addon.grams !== ""
            ? parseInt(body.addon.grams, 10)
            : 30;
          const { error } = await supabase
            .from("product_addons")
            .update({
              name: body.addon.name,
              price: body.addon.price,
              calories: body.addon.calories ?? lookupAddonCalories(body.addon.name) ?? null,
              grams: Number.isFinite(resolvedGrams) && resolvedGrams > 0 ? resolvedGrams : 30
            })
            .in("id", body.ids);
          if (error) throw error;
          result = { success: true };
        } else {
          result = await updateAddon(body.id, body.addon);
        }
        break;
      }
      case "addon-delete": {
        if (body.ids && Array.isArray(body.ids)) {
          const { error } = await supabase
            .from("product_addons")
            .delete()
            .in("id", body.ids);
          if (error) throw error;
          result = { success: true };
        } else {
          result = await deleteAddon(body.id);
        }
        break;
      }
      case "addon-visibility": {
        result = await updateAddonVisibility(body.id, Boolean(body.is_active));
        break;
      }
      case "coupon-create": {
        result = await createCoupon(body.coupon);
        break;
      }
      case "coupon-update": {
        result = await updateCoupon(body.code, body.coupon);
        break;
      }
      case "coupon-delete": {
        result = await deleteCoupon(body.code);
        break;
      }
      case "coin-adjust": {
        const { phone, actionType, amount } = body;
        result = await adjustWalletCoins(phone, actionType, parseInt(amount, 10));
        break;
      }
      case "settings-update": {
        result = await updateSettings(body.settings);
        break;
      }
      case "update-create": {
        result = await createUpdate(body.update);
        break;
      }
      case "update-update": {
        result = await updateUpdate(body.id, body.update);
        break;
      }
      case "update-delete": {
        result = await deleteUpdate(body.id);
        break;
      }
      case "event-create": {
        result = await createEvent(body.event);
        break;
      }
      case "event-update": {
        result = await updateEvent(body.id, body.event);
        break;
      }
      case "event-delete": {
        result = await deleteEvent(body.id);
        break;
      }
      case "upcoming-create": {
        result = await createUpcomingItem(body.upcomingItem);
        break;
      }
      case "upcoming-update": {
        result = await updateUpcomingItem(body.id, body.upcomingItem);
        break;
      }
      case "upcoming-delete": {
        result = await deleteUpcomingItem(body.id);
        break;
      }
      case "event-registrations-get": {
        result = await getEventRegistrations(body.eventId);
        break;
      }
      case "contact-delete": {
        result = await deleteContactSubmission(body.id);
        break;
      }
      default:
        return NextResponse.json({ success: false, error: `Invalid action '${action}'` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Operation '${action}' completed successfully.`,
      data: result
    });

  } catch (error) {
    console.error("Admin POST mutation failure:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
