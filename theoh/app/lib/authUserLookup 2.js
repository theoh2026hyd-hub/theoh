import { supabase } from "@/app/lib/supabaseClient";
import { normalizeUserEmail } from "@/app/lib/userAuth";

export async function findAuthUserByEmail(email) {
  const normalized = normalizeUserEmail(email);
  if (!normalized || !supabase) return null;

  const { data: profile } = await supabase
    .from("user_details")
    .select("user_id, email, full_name, phone, auth_provider")
    .eq("email", normalized)
    .maybeSingle();

  if (profile?.user_id) {
    const { data: authData, error } = await supabase.auth.admin.getUserById(profile.user_id);
    if (!error && authData?.user) {
      return { user: authData.user, profile };
    }
  }

  let page = 1;
  const perPage = 200;

  while (page <= 5) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = (data.users || []).find(
      (entry) => entry.email?.toLowerCase() === normalized
    );
    if (match) {
      return { user: match, profile };
    }

    if (!data.users?.length || data.users.length < perPage) break;
    page += 1;
  }

  return profile ? { user: null, profile } : null;
}

export async function ensureAuthUserForEmail({ email, fullName, authProvider = "email" }) {
  const normalized = normalizeUserEmail(email);
  const existing = await findAuthUserByEmail(normalized);

  if (existing?.user) {
    return existing.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || normalized.split("@")[0],
      auth_provider: authProvider,
    },
  });

  if (error) {
    const retry = await findAuthUserByEmail(normalized);
    if (retry?.user) {
      return retry.user;
    }
    throw error;
  }

  return data.user;
}
