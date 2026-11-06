import { createClient } from "@/app/lib/supabase/server";
import { supabase as supabaseAdmin } from "@/app/lib/supabaseClient";
import { normalizeUserEmail } from "@/app/lib/userAuth";

export async function establishSessionForEmail(email, options = {}) {
  const normalized = normalizeUserEmail(email);
  const supabase = await createClient();

  if (options.idToken) {
    const { error: idTokenError } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: options.idToken,
    });
    if (!idTokenError) {
      return supabase;
    }
    console.error("Google idToken sign-in failed:", idTokenError.message);
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
  });

  if (linkError) {
    if (/after \d+ seconds/i.test(linkError.message || "")) {
      throw new Error("Please wait a moment before signing in again.");
    }
    throw linkError;
  }

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Could not create a login session.");
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });

  if (verifyError) {
    if (/after \d+ seconds/i.test(verifyError.message || "")) {
      throw new Error("Please wait a moment before signing in again.");
    }
    throw verifyError;
  }

  return supabase;
}
