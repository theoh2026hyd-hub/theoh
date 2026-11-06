import { getProductImagePublicUrl } from "./productImageStorage";

export const BRAND_LOGO = "/theoh!.jpg";
export const DEFAULT_PRODUCT_IMAGE = "/why_us_premium_oats.png";
export const HERO_FALLBACK_IMAGE = "/why_us_premium_oats.png";

/** Local public/ assets that actually exist in this repo. */
const EXISTING_PUBLIC_IMAGES = new Set([
  BRAND_LOGO,
  DEFAULT_PRODUCT_IMAGE,
  HERO_FALLBACK_IMAGE,
  "/oatmeal_raisin_cookie.png",
  "/chocolate_chip_cookie.png",
  "/raw_premium_oats.png",
  "/raw_dried_berries.png",
  "/raw_mixed_nuts.png",
  "/raw_organic_honey.png",
]);

const KNOWN_PUBLIC_IMAGES = EXISTING_PUBLIC_IMAGES;

function getConfiguredSupabaseOrigin() {
  const raw = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

/** Rewrite storage URLs from retired/misconfigured Supabase hosts to the current project. */
export function rewriteSupabaseStorageUrl(image) {
  const trimmed = String(image || "").trim();
  if (!trimmed) return "";

  const currentOrigin = getConfiguredSupabaseOrigin();
  if (!currentOrigin) return trimmed;

  const storageMarker = "/storage/v1/object/public/";
  const markerIndex = trimmed.indexOf(storageMarker);
  if (markerIndex === -1) return trimmed;

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`);
    if (!parsed.hostname.endsWith(".supabase.co")) return trimmed;
    if (parsed.origin === currentOrigin) return parsed.toString();
    return `${currentOrigin}${parsed.pathname}${parsed.search}`;
  } catch {
    const pathPart = trimmed.slice(markerIndex);
    return `${currentOrigin}${pathPart}`;
  }
}

function pickFallback(category = "", name = "") {
  const cat = String(category || "").toLowerCase();
  const itemName = String(name || "").toLowerCase();

  if (cat.includes("cookie") || itemName.includes("cookie")) {
    return itemName.includes("oatmeal") || itemName.includes("raisin")
      ? "/oatmeal_raisin_cookie.png"
      : "/chocolate_chip_cookie.png";
  }
  if (itemName.includes("fruit") || itemName.includes("berry")) {
    return "/raw_dried_berries.png";
  }
  if (itemName.includes("muesli") || itemName.includes("nut") || itemName.includes("mix")) {
    return "/raw_mixed_nuts.png";
  }
  if (itemName.includes("honey")) {
    return "/raw_organic_honey.png";
  }
  if (cat.includes("bread") || cat.includes("raw") || itemName.includes("oat") || itemName.includes("bowl") || cat.includes("custom")) {
    return "/raw_premium_oats.png";
  }
  return DEFAULT_PRODUCT_IMAGE;
}

/** Normalize any stored product image reference to a browser-loadable URL. */
export function normalizeProductImageUrl(image) {
  const trimmed = String(image || "").trim();
  if (!trimmed) return "";

  const rewritten = rewriteSupabaseStorageUrl(trimmed);
  if (rewritten !== trimmed) return rewritten;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes("supabase.co/storage/v1/object/public/")) {
    return rewriteSupabaseStorageUrl(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`
    );
  }

  const storagePath = trimmed.replace(/^\/+/, "");
  if (storagePath.startsWith("products/")) {
    return getProductImagePublicUrl(storagePath);
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** Resolve the image URL shown in the user catalog and order UI. */
export function resolveProductImage(image, category = "", name = "") {
  const normalized = normalizeProductImageUrl(image);
  if (normalized) {
    return normalized;
  }
  return pickFallback(category, name);
}

export function resolveBrandLogo(image = BRAND_LOGO) {
  return image || BRAND_LOGO;
}

export function isKnownPublicProductImage(image) {
  const normalized = normalizeProductImageUrl(image);
  return KNOWN_PUBLIC_IMAGES.has(normalized);
}

export function getSafeLocalFallback(category = "", name = "") {
  const candidate = pickFallback(category, name);
  return EXISTING_PUBLIC_IMAGES.has(candidate) ? candidate : DEFAULT_PRODUCT_IMAGE;
}
