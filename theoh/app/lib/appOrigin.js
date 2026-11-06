/**
 * Canonical app origin for OAuth redirects and absolute email links.
 *
 * Never send Google OAuth back to localhost when the visitor hit a public host
 * (common misconfig: NEXT_PUBLIC_SITE_URL=http://localhost:3000 on Vercel).
 * That breaks iOS Safari with "Safari can't open the page… localhost".
 */

function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

export function isLocalhostOrigin(origin) {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  } catch {
    return /localhost|127\.0\.0\.1|\.local/i.test(String(origin || ""));
  }
}

/** Origin from the inbound request (works behind Vercel / proxies). */
export function getOriginFromRequest(request) {
  if (!request) return "";

  const xfHost = String(request.headers.get("x-forwarded-host") || "")
    .split(",")[0]
    .trim();
  const host = xfHost || String(request.headers.get("host") || "").trim();
  if (!host) {
    try {
      return stripTrailingSlash(new URL(request.url).origin);
    } catch {
      return "";
    }
  }

  const xfProto = String(request.headers.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  let proto = xfProto;
  if (!proto) {
    try {
      proto = new URL(request.url).protocol.replace(":", "") || "https";
    } catch {
      proto = "https";
    }
  }

  // Localhost over plain http is fine; public hosts should use https when proto missing.
  if (!xfProto && !isLocalhostOrigin(`http://${host}`)) {
    proto = "https";
  }

  return stripTrailingSlash(`${proto}://${host}`);
}

export function getSiteOrigin() {
  const fromEnv = stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || "");
  if (fromEnv) return fromEnv;
  const vercel = stripTrailingSlash(process.env.VERCEL_URL || "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "";
}

/**
 * Prefer a public request host over a localhost env URL.
 * Prefer a configured public SITE_URL when the request itself is localhost
 * (e.g. local tools), so emails still point at production if configured.
 */
export function getAppOrigin(request) {
  const fromRequest = getOriginFromRequest(request);
  const fromEnv = getSiteOrigin();

  if (fromRequest && !isLocalhostOrigin(fromRequest)) {
    // Visitor is on the real site / preview — never override with localhost env.
    if (fromEnv && !isLocalhostOrigin(fromEnv)) {
      // Prefer canonical env when both are public (matches Google Console).
      try {
        if (new URL(fromEnv).host === new URL(fromRequest).host) {
          return fromEnv;
        }
      } catch {
        /* fall through */
      }
      // Different public hosts (custom domain vs vercel.app): use the host the user actually opened.
      return fromRequest;
    }
    return fromRequest;
  }

  if (fromEnv && !isLocalhostOrigin(fromEnv)) {
    return fromEnv;
  }

  return fromRequest || fromEnv || "";
}

/** Allow OAuth state origin only if it matches request or configured site URL. */
export function isTrustedOAuthOrigin(candidate, request) {
  if (!candidate) return false;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const allowed = new Set();
  for (const value of [getOriginFromRequest(request), getSiteOrigin(), getAppOrigin(request)]) {
    if (!value) continue;
    try {
      allowed.add(new URL(value).origin);
    } catch {
      /* ignore */
    }
  }

  return allowed.has(parsed.origin);
}
