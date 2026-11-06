import { supabase } from "@/app/lib/supabaseClient";
import { normalizeUserEmail } from "@/app/lib/userAuth";
import { isPlaceholderPhone } from "@/app/lib/userProfileSync";

export async function getRegisteredProfileByUserId(userId) {
  if (!userId || !supabase) return null;

  const { data, error } = await supabase
    .from("user_details")
    .select("user_id, email, full_name, customer_name, phone, auth_provider, delivery_address, favorites")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.user_id === userId ? data : null;
}

export async function isEmailRegistered(email) {
  const normalized = normalizeUserEmail(email);
  if (!normalized || !supabase) return false;

  const { data, error } = await supabase
    .from("user_details")
    .select("user_id")
    .eq("email", normalized)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.user_id);
}

export function profileNeedsPhone(profile, userId) {
  if (!profile) return true;
  if (!profile.phone) return true;
  return isPlaceholderPhone(profile.phone, userId);
}
