export const DEFAULT_MENU_SKELETON_COUNT = 8;
const UPCOMING_MARQUEE_CACHE_KEY = "theoh_has_upcoming_marquee";
const MENU_PAYLOAD_CACHE_KEY = "theoh_menu_payload_v2";

export function getMostOrderedMenuItems(menuItems, mostOrderedProductIds = []) {
  const rankById = new Map(
    mostOrderedProductIds.map((productId, index) => [Number(productId), index])
  );

  return menuItems
    .filter((item) => rankById.has(Number(item.id)))
    .sort((a, b) => rankById.get(Number(a.id)) - rankById.get(Number(b.id)));
}

export function getDisplayMenuItemCount(
  menuItems,
  selectedCategory,
  selectedOatsSub,
  favorites,
  mostOrderedProductIds = []
) {
  if (selectedCategory === "Most Ordered") {
    return getMostOrderedMenuItems(menuItems, mostOrderedProductIds).length;
  }

  const filtered = menuItems.filter((item) => {
    if (selectedCategory === "Favorites") {
      return favorites.includes(item.id);
    }
    return selectedCategory === "All" || item.category === selectedCategory;
  });

  if (selectedCategory === "Oats") {
    return filtered.filter((item) => (item.subCategory || "regular") === selectedOatsSub).length;
  }

  return filtered.length;
}

export function getCachedMenuSkeletonCount() {
  const raw = sessionStorage.getItem("theoh_menu_all_count");
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MENU_SKELETON_COUNT;
}

export function cacheMenuAllCount(menuItems) {
  if (typeof window === "undefined" || !Array.isArray(menuItems) || menuItems.length === 0) {
    return;
  }
  sessionStorage.setItem("theoh_menu_all_count", String(menuItems.length));
}

export function cacheMenuPayload(data) {
  if (typeof window === "undefined" || !data?.success || !Array.isArray(data.menu)) {
    return;
  }
  try {
    sessionStorage.setItem(
      MENU_PAYLOAD_CACHE_KEY,
      JSON.stringify({
        menu: data.menu,
        mostOrderedProductIds: data.mostOrderedProductIds || [],
        settings: data.settings || {},
        coupons: data.coupons || [],
        upcomingItems: data.upcomingItems || [],
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

export function readCachedMenuPayload() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MENU_PAYLOAD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.menu) || parsed.menu.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCachedUpcomingMarqueeVisible() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(UPCOMING_MARQUEE_CACHE_KEY) === "1";
  } catch {
    return false;
  }
}

export function cacheUpcomingMarqueeVisible(visible) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(UPCOMING_MARQUEE_CACHE_KEY, visible ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}
