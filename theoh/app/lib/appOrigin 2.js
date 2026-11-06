/**
 * Canonical app origin for OAuth redirects.
 * Prefer NEXT_PUBLIC_SITE_URL on Vercel so redirect_uri matches Google Console exactly.
 */
export function getAppOrigin(request) {
  const fromEnv = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(request.url).origin;
}
