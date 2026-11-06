import { supabase } from "@/app/lib/supabaseClient";
import { normalizeUserEmail } from "@/app/lib/userAuth";
import { getPhoneLast10 } from "@/app/lib/phone";

export function buildPlaceholderPhone(userId) {
  const digits = String(userId || "").replace(/\D/g, "");
  const suffix = digits.slice(-10).padStart(10, "0");
  return `9${suffix.slice(1)}`;
}

export function isPlaceholderPhone(phone, userId) {
  if (!phone || !userId) return false;
  return getPhoneLast10(phone) === buildPlaceholderPhone(userId);
}

export async function updateUserPhone(userId, newPhone, extraFields = {}) {
  const normalized = getPhoneLast10(newPhone);
  if (normalized.length < 10) {
    throw new Error("A valid 10-digit phone number is required.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("user_details")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    return upsertUserProfile({
      userId,
      phone: normalized,
      ...extraFields,
    });
  }

  const oldPhone = getPhoneLast10(existing.phone);
  if (oldPhone === normalized) {
    const { data, error } = await supabase
      .from("user_details")
      .update({
        ...extraFields,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data: phoneConflict } = await supabase
    .from("user_details")
    .select("user_id")
    .eq("phone", normalized)
    .maybeSingle();

  if (phoneConflict && phoneConflict.user_id !== userId) {
    throw new Error("This phone number is already linked to another account.");
  }

  const { data: oldWallet } = await supabase
    .from("coin_wallet")
    .select("*")
    .eq("phone", oldPhone)
    .maybeSingle();

  const { data: newWallet } = await supabase
    .from("coin_wallet")
    .select("*")
    .eq("phone", normalized)
    .maybeSingle();

  const { data: updated, error: updateError } = await supabase
    .from("user_details")
    .update({
      phone: normalized,
      ...extraFields,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError) throw updateError;

  if (oldWallet) {
    if (newWallet) {
      await supabase
        .from("coin_wallet")
        .update({
          balance: (newWallet.balance || 0) + (oldWallet.balance || 0),
          order_count: Math.max(newWallet.order_count || 0, oldWallet.order_count || 0),
        })
        .eq("phone", normalized);
      await supabase.from("coin_wallet").delete().eq("phone", oldPhone);
    } else {
      await supabase.from("coin_wallet").update({ phone: normalized }).eq("phone", oldPhone);
    }
  } else if (!newWallet) {
    await ensureCoinWallet(normalized);
  }

  return updated;
}

export async function upsertUserProfile({
  userId,
  email,
  fullName,
  authProvider = "email",
  phone,
}) {
  if (!supabase) {
    throw new Error("Database unavailable.");
  }

  const normalizedEmail = email ? normalizeUserEmail(email) : null;
  const displayName = (fullName || "User").trim() || "User";
  const normalizedPhoneInput = phone ? getPhoneLast10(phone) : null;

  const { data: existingByUserId } = await supabase
    .from("user_details")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: existingByEmail } =
    !existingByUserId && normalizedEmail
      ? await supabase
          .from("user_details")
          .select("*")
          .eq("email", normalizedEmail)
          .maybeSingle()
      : { data: null };

  const existing = existingByUserId || existingByEmail;

  if (
    normalizedPhoneInput &&
    normalizedPhoneInput.length >= 10 &&
    existing?.phone &&
    getPhoneLast10(existing.phone) !== normalizedPhoneInput
  ) {
    return updateUserPhone(userId, normalizedPhoneInput, {
      email: normalizedEmail,
      full_name: displayName,
      customer_name: displayName,
      auth_provider: authProvider,
      user_id: userId,
    });
  }

  const resolvedPhone =
    (normalizedPhoneInput && normalizedPhoneInput.length >= 10
      ? normalizedPhoneInput
      : null) ||
    (existing?.phone && !isPlaceholderPhone(existing.phone, userId)
      ? getPhoneLast10(existing.phone)
      : null) ||
    existing?.phone ||
    buildPlaceholderPhone(userId);

  const payload = {
    user_id: userId,
    email: normalizedEmail,
    full_name: displayName,
    customer_name: displayName,
    auth_provider: authProvider,
    phone: resolvedPhone,
    updated_at: new Date().toISOString(),
  };

  if (existing?.phone) {
    const { data, error } = await supabase
      .from("user_details")
      .update(payload)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;
    await ensureCoinWallet(data.phone);
    return data;
  }

  const { data, error } = await supabase
    .from("user_details")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    const { data: upserted, error: upsertError } = await supabase
      .from("user_details")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (upsertError) throw upsertError;
    await ensureCoinWallet(upserted.phone);
    return upserted;
  }

  await ensureCoinWallet(data.phone);
  return data;
}

async function ensureCoinWallet(phone) {
  const { data: wallet } = await supabase
    .from("coin_wallet")
    .select("balance")
    .eq("phone", phone)
    .maybeSingle();

  if (!wallet) {
    const { error } = await supabase.from("coin_wallet").insert({
      phone,
      balance: 10,
      order_count: 0,
    });
    if (error) throw error;
  }
}
