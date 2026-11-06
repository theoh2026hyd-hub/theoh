import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/app/lib/googleOAuth";
import { getAppOrigin, getOriginFromRequest, isLocalhostOrigin } from "@/app/lib/appOrigin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = getAppOrigin(request);
    if (!origin) {
      throw new Error("Could not determine site origin for Google OAuth.");
    }

    // Refuse to start Google OAuth with a localhost redirect when the user is on a phone/public host.
    // (iOS Safari then shows "couldn't connect to the server" for localhost.)
    if (isLocalhostOrigin(origin)) {
      const host = (
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        ""
      )
        .split(",")[0]
        .trim();
      if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
        throw new Error(
          "Google sign-in is misconfigured: NEXT_PUBLIC_SITE_URL points at localhost. Set it to your live https URL."
        );
      }
    }

    const next = searchParams.get("next") || "/profile";
    const safeNext = String(next).startsWith("/") ? next : "/profile";
    const redirectUri = `${origin}/api/auth/google/callback`;
    // Persist origin in state so callback uses the exact same redirect_uri.
    const state = Buffer.from(JSON.stringify({ next: safeNext, origin })).toString("base64url");
    const authUrl = buildGoogleAuthUrl(redirectUri, state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Google auth start error:", error);
    const fallbackOrigin = getAppOrigin(request) || getOriginFromRequest(request);
    if (!fallbackOrigin || isLocalhostOrigin(fallbackOrigin)) {
      return NextResponse.json(
        {
          success: false,
          error:
            error?.message ||
            "Google sign-in is misconfigured. Set NEXT_PUBLIC_SITE_URL to your live https domain.",
        },
        { status: 500 }
      );
    }
    return NextResponse.redirect(new URL("/profile?auth=error&reason=config", fallbackOrigin));
  }
}
