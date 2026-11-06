import { NextResponse } from "next/server";
import { formatOrderItemSummary } from "@/app/lib/cartDisplay";
import { buildOrderEnjoyDetails, parseScheduleFromInstructions } from "@/app/lib/orderEnjoyDetails";
import { formatOrderNumber } from "@/app/lib/orderNumber";
import { resolveProductImage } from "@/app/lib/productImages";
import { getPhoneLast10, isValidPhone } from "@/app/lib/phone";
import { supabase } from "@/app/lib/supabaseClient";
import { createClient } from "@/app/lib/supabase/server";
import { getWalletDetails, getUsedCouponCodes } from "@/app/lib/dbService";
import { normalizeProfileAddress } from "@/app/lib/profileAddress";
import { updateUserPhone } from "@/app/lib/userProfileSync";

function parseOrderAddons(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function resolveProfileContext(request) {
  const { searchParams } = new URL(request.url);
  const phoneParam = searchParams.get("phone");

  if (phoneParam) {
    const cleanPhone = phoneParam.trim();
    return {
      phoneLast10: getPhoneLast10(cleanPhone),
      cleanPhone,
      authUserId: null,
    };
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profileByUserId } = await supabase
    .from("user_details")
    .select("phone, email, full_name, customer_name, delivery_address, favorites, auth_provider, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileByUserId?.user_id === user.id && profileByUserId.phone) {
    return {
      phoneLast10: getPhoneLast10(profileByUserId.phone),
      cleanPhone: profileByUserId.phone,
      authUserId: user.id,
      authProfile: profileByUserId,
      authEmail: user.email,
    };
  }

  return {
    phoneLast10: null,
    cleanPhone: null,
    authUserId: user.id,
    authProfile: null,
    authEmail: user.email,
  };
}

export async function GET(request) {
  try {
    const context = await resolveProfileContext(request);

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Authentication or phone number is required." },
        { status: 401 }
      );
    }

    const { phoneLast10, cleanPhone, authProfile, authEmail, authUserId } = context;

    if (authUserId && !authProfile) {
      return NextResponse.json(
        {
          success: false,
          code: "NOT_REGISTERED",
          error: "No account found. Please sign up before signing in.",
        },
        { status: 403 }
      );
    }

    if (!phoneLast10) {
      return NextResponse.json({
        success: true,
        wallet: {
          phone: null,
          balance: 0,
          orderCount: 0,
          customerName: authProfile?.full_name || authProfile?.customer_name || "User",
          fullName: authProfile?.full_name || authProfile?.customer_name || "User",
          email: authProfile?.email || authEmail || null,
          authProvider: authProfile?.auth_provider || "email",
          deliveryAddress: normalizeProfileAddress(authProfile?.delivery_address),
          favorites: authProfile?.favorites || [],
        },
        orders: [],
        addresses: authProfile?.delivery_address
          ? [normalizeProfileAddress(authProfile.delivery_address)].filter(Boolean)
          : [],
        usedCouponCodes: [],
      });
    }

    // 1. Fetch wallet details (try normalized phone first)
    let wallet = await getWalletDetails(phoneLast10);
    if (!wallet.balance && !wallet.order_count) {
      wallet = await getWalletDetails(cleanPhone);
    }
    const usedCouponCodes = await getUsedCouponCodes(phoneLast10);

    // Retrieve profile details to show guest name & address
    let customerName = "User";
    let fullName = "User";
    let email = authEmail || null;
    let authProvider = "email";
    let deliveryAddress = null;
    let favorites = [];

    // Try fetching from user_details table
    let userProfile = authProfile || null;
    let profileError = null;

    if (!userProfile) {
      const primaryProfile = await supabase
        .from("user_details")
        .select("customer_name, full_name, email, auth_provider, delivery_address, favorites")
        .eq("phone", phoneLast10)
        .maybeSingle();
      userProfile = primaryProfile.data;
      profileError = primaryProfile.error;
    }

    if (!userProfile) {
      const altProfile = await supabase
        .from("user_details")
        .select("customer_name, full_name, email, auth_provider, delivery_address, favorites")
        .eq("phone", cleanPhone)
        .maybeSingle();
      if (altProfile.data) {
        userProfile = altProfile.data;
      }
    }

    if (userProfile && !profileError) {
      customerName = userProfile.customer_name || userProfile.full_name || "User";
      fullName = userProfile.full_name || userProfile.customer_name || "User";
      email = userProfile.email || email;
      authProvider = userProfile.auth_provider || "email";
      deliveryAddress = normalizeProfileAddress(userProfile.delivery_address);
      favorites = userProfile.favorites || [];
    }

    // Fetch orders with nested items (exclude legacy PROFILE- stubs if any remain)
    const { data: ordersRaw, error: ordersError } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        grand_total,
        subtotal,
        coin_discount,
        promo_discount,
        tax,
        coins_earned,
        status,
        status_class,
        delivery_address,
        customer_name,
        customer_phone,
        receiver_name,
        receiver_phone,
        special_instructions,
        order_items (
          product_id,
          name,
          quantity,
          price,
          selected_addons
        )
      `)
      .like("customer_phone", `%${phoneLast10}`)
      .not("id", "ilike", "PROFILE-%")
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    const orders = (ordersRaw || []).filter(
      (order) => getPhoneLast10(order.customer_phone) === phoneLast10
    );

    const { data: settingsData } = await supabase.from("settings").select("*");
    const settings = {};
    if (settingsData) {
      settingsData.forEach((entry) => {
        settings[entry.key] = entry.value;
      });
    }

    const productIds = [
      ...new Set(
        orders.flatMap((order) =>
          (order.order_items || []).map((item) => item.product_id).filter(Boolean)
        )
      )
    ];

    const productImageMap = new Map();
    if (productIds.length > 0) {
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name, image, categories(name)")
        .in("id", productIds);

      for (const product of productRows || []) {
        productImageMap.set(
          product.id,
          resolveProductImage(product.image, product.categories?.name, product.name)
        );
      }
    }

    // 3. Format past orders list to match client UI expectation
    const formattedOrders = orders.map((order) => {
      const itemsString = order.order_items
        ? order.order_items.map((item) => formatOrderItemSummary(item)).join(", ")
        : "No items listed";

      const baseOrder = {
        id: order.id,
        orderNumber: order.order_number ?? null,
        displayOrderId: formatOrderNumber(order.order_number),
        date: new Date(order.created_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        }),
        items: itemsString,
        total: parseFloat(order.grand_total || 0),
        grandTotal: parseFloat(order.grand_total || 0),
        subtotal: parseFloat(order.subtotal || 0),
        coinDiscount: parseFloat(order.coin_discount || 0),
        promoDiscount: parseFloat(order.promo_discount || 0),
        tax: parseFloat(order.tax || 0),
        coinsEarned: order.coins_earned || 0,
        deliveryAddress: order.delivery_address || "",
        customerName: order.customer_name || "",
        customerPhone: order.customer_phone || "",
        receiverName: order.receiver_name || "",
        receiverPhone: order.receiver_phone || "",
        deliveryDateTime: parseScheduleFromInstructions(order.special_instructions),
        specialInstructions: order.special_instructions || "",
        status: order.status,
        statusClass: order.status_class,
        itemsList: (order.order_items || []).map((item) => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price || 0),
          selected_addons: parseOrderAddons(item.selected_addons),
          image:
            productImageMap.get(item.product_id) ??
            resolveProductImage(null, "Oats", item.name)
        }))
      };

      return buildOrderEnjoyDetails(baseOrder, settings);
    });

    // Saved addresses for checkout — profile address only (not past order addresses)
    const uniqueAddresses = new Set();
    if (deliveryAddress) {
      uniqueAddresses.add(deliveryAddress);
    }

    return NextResponse.json({
      success: true,
      wallet: {
        phone: phoneLast10,
        balance: wallet.balance,
        orderCount: wallet.order_count,
        customerName,
        fullName,
        email,
        authProvider,
        deliveryAddress,
        favorites
      },
      orders: formattedOrders,
      addresses: Array.from(uniqueAddresses),
      usedCouponCodes
    });

  } catch (error) {
    console.error("Error retrieving user profile:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { phone, customerName, deliveryAddress, favorites } = body;

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    const requestedPhone = phone?.trim() ? getPhoneLast10(phone) : null;

    let normalizedPhone = requestedPhone;

    if (user) {
      const { data: authProfile } = await supabase
        .from("user_details")
        .select("phone, email, full_name, customer_name, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!authProfile?.user_id) {
        return NextResponse.json(
          {
            success: false,
            code: "NOT_REGISTERED",
            error: "No account found. Please sign up before signing in.",
          },
          { status: 403 }
        );
      }

      if (
        requestedPhone &&
        requestedPhone.length >= 10 &&
        authProfile?.phone &&
        getPhoneLast10(authProfile.phone) !== requestedPhone
      ) {
        await updateUserPhone(user.id, requestedPhone, {
          user_id: user.id,
          email: user.email?.toLowerCase() || authProfile.email || null,
          customer_name:
            customerName !== undefined
              ? customerName
              : authProfile.customer_name || authProfile.full_name || "User",
          full_name:
            customerName !== undefined
              ? customerName
              : authProfile.full_name || authProfile.customer_name || "User",
        });
        normalizedPhone = requestedPhone;
      } else if (authProfile?.phone) {
        normalizedPhone = getPhoneLast10(authProfile.phone);
      } else if (requestedPhone && requestedPhone.length >= 10) {
        normalizedPhone = requestedPhone;
      }
    }

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: "Phone number must be exactly 10 digits. Extra digits are not allowed." },
        { status: 400 }
      );
    }

    // 1. Try upserting to user_details table
    const payload = {
      phone: normalizedPhone,
      updated_at: new Date().toISOString()
    };
    if (customerName !== undefined) {
      payload.customer_name = customerName;
      payload.full_name = customerName;
    }
    if (deliveryAddress !== undefined) payload.delivery_address = deliveryAddress;
    if (favorites !== undefined) payload.favorites = favorites;
    if (user) {
      payload.user_id = user.id;
      payload.email = user.email?.toLowerCase() || null;
      if (!payload.full_name) {
        payload.full_name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          customerName ||
          "User";
      }
    }

    try {
      const { error: userDetailsError } = await supabase
        .from("user_details")
        .upsert(payload);

      if (userDetailsError) {
        console.warn("user_details upsert warning:", userDetailsError.message);
        throw userDetailsError;
      }
    } catch (e) {
      console.error("Failed to save profile to user_details:", e);
      return NextResponse.json(
        { success: false, error: "Could not save profile. Please try again." },
        { status: 500 }
      );
    }

    // Ensure coin wallet exists for this phone (points initially 0)
    const { data: wallet } = await supabase
      .from("coin_wallet")
      .select("balance")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (!wallet) {
      const { error: insertError } = await supabase
        .from("coin_wallet")
        .insert({
          phone: normalizedPhone,
          balance: 10, // 10 welcome coins for every unique user
          order_count: 0
        });
      if (insertError) throw insertError;
    }

    const walletDetails = await getWalletDetails(normalizedPhone);
    let profileDetails = null;

    if (user) {
      const { data: profileRow } = await supabase
        .from("user_details")
        .select("customer_name, full_name, email, auth_provider, delivery_address, favorites")
        .eq("user_id", user.id)
        .maybeSingle();
      profileDetails = profileRow;
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      wallet: {
        phone: normalizedPhone,
        balance: walletDetails.balance || 0,
        orderCount: walletDetails.order_count || 0,
        customerName:
          profileDetails?.customer_name ||
          profileDetails?.full_name ||
          customerName ||
          "User",
        fullName:
          profileDetails?.full_name ||
          profileDetails?.customer_name ||
          customerName ||
          "User",
        email: profileDetails?.email || user?.email?.toLowerCase() || null,
        authProvider: profileDetails?.auth_provider || "email",
        deliveryAddress: normalizeProfileAddress(profileDetails?.delivery_address),
        favorites: profileDetails?.favorites || favorites || [],
      },
    });

  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


