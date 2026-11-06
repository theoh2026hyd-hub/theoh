import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/app/lib/googleOAuth";
import { establishSessionForEmail } from "@/app/lib/establishSession";
import { ensureAuthUserForEmail } from "@/app/lib/authUserLookup";
import { upsertUserProfile } from "@/app/lib/userProfileSync";
import { normalizeUserEmail } from "@/app/lib/userAuth";
import { profileNeedsPhone } from "@/app/lib/userRegistration";
import { getAppOrigin, isTrustedOAuthOrigin } from "@/app/lib/appOrigin";

function authErrorRedirect(origin, reason = "unknown") {
  return NextResponse.redirect(
    new URL(`/profile?auth=error&reason=${encodeURIComponent(reason)}`, origin)
  );
}

export async function GET(request) {
  let origin = getAppOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const oauthError = searchParams.get("error");

  let nextPath = "/profile";
  try {
    if (stateRaw) {
      const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
      if (parsed?.next && String(parsed.next).startsWith("/")) {
        nextPath = parsed.next;
      }
      if (parsed?.origin && isTrustedOAuthOrigin(parsed.origin, request)) {
        origin = String(parsed.origin).replace(/\/$/, "");
      }
    }
  } catch {
    // keep defaults
  }

  if (!origin) {
    origin = getAppOrigin(request);
  }

  if (oauthError || !code) {
    return authErrorRedirect(origin, oauthError === "access_denied" ? "denied" : "oauth");
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const googleProfile = await exchangeGoogleCode(code, redirectUri);
    const email = normalizeUserEmail(googleProfile.email);
    const fullName = String(googleProfile.fullName || email.split("@")[0]).trim() || "User";

    const authUser = await ensureAuthUserForEmail({
      email,
      fullName,
      authProvider: "google",
    });

    const profile = await upsertUserProfile({
      userId: authUser.id,
      email,
      fullName,
      authProvider: "google",
    });

    await establishSessionForEmail(email, {
      idToken: googleProfile.idToken,
    });

    const needsPhone = profileNeedsPhone(profile, authUser.id);
    const redirectUrl = new URL(nextPath, origin);
    if (needsPhone) {
      redirectUrl.searchParams.set("auth", "phone_required");
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Google auth callback error:", error);
    const message = String(error?.message || "");
    let reason = "unknown";
    if (/redirect_uri|invalid_grant|token exchange/i.test(message)) {
      reason = "redirect";
    } else if (/not configured|placeholder/i.test(message)) {
      reason = "config";
    } else if (/session|signInWithIdToken|verifyOtp|magiclink/i.test(message)) {
      reason = "session";
    }
    return authErrorRedirect(origin, reason);
  }
}
