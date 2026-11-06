import { getProductImagePublicUrl } from "./productImageStorage";

export const BRAND_LOGO = "/theoh!.jpg";
export const DEFAULT_PRODUCT_IMAGE = "/why_us_premium_oats.png";
export const HERO_FALLBACK_IMAGE = "/why_us_premium_oats.png";

const KNOWN_PUBLIC_IMAGES = new Set([
  BRAND_LOGO,
  "/theoh-admin-logo.png",
  DEFAULT_PRODUCT_IMAGE,
  HERO_FALLBACK_IMAGE,
  "/oatmeal_raisin_cookie.png",
  "/chocolate_chip_cookie.png",
  "/raw_premium_oats.png",
  "/raw_dried_berries.png",
  "/raw_mixed_nuts.png",
  "/raw_organic_honey.png",
  "/raw_almond_milk.png",
  "/upcoming_matcha_oats.png",
  "/upcoming_chia_pudding.png",
  "/upcoming_cold_brew.png",
  "/fruit_oats.png",
  "/chocolate_oats.png",
  "/muesli.png",
  "/plain_oats.png",
  "/brown_bread.png",
  "/multi_grain_bread.png",
  "/whole_wheat_bread.png",
  "/all_mix_oats.png",
  "/about_oats.png",
  "/hero_sushi_bowl.png",
  "/wagyu_beef.png",
  "/matcha_lava.png",
  "/upcoming_sushi.png",
  "/masala_oats.png",
  "/south_indian_upma.png",
  "/family_combo.png",
]);

function pickFallback(category = "", name = "") {
  const cat = String(category || "").toLowerCase();
  const itemName = String(name || "").toLowerCase();

  if (cat.includes("cookie") || itemName.includes("cookie")) {
    return itemName.includes("oatmeal") || itemName.includes("raisin")
      ? "/oatmeal_raisin_cookie.png"
      : "/chocolate_chip_cookie.png";
  }
  if (itemName.includes("chocolate") || itemName.includes("matcha")) {
    return "/upcoming_matcha_oats.png";
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
  if (itemName.includes("milk")) {
    return "/raw_almond_milk.png";
  }
  if (cat.includes("bread")) {
    return "/raw_premium_oats.png";
  }
  if (cat.includes("raw")) {
    return "/raw_premium_oats.png";
  }
  return DEFAULT_PRODUCT_IMAGE;
}

/** Normalize any stored product image reference to a browser-loadable URL. */
export function normalizeProductImageUrl(image) {
  const trimmed = String(image || "").trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes("supabase.co/storage/v1/object/public/")) {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
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
