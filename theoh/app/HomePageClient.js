"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, MapPin, Leaf, Flame, Sparkles } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import MenuCard from "./components/MenuCard";
import MenuCatalogSkeleton from "./components/MenuCatalogSkeleton";
import ProductDetailsModal from "./components/ProductDetailsModal";
import BowlBuilderModal from "./components/BowlBuilderModal";
import SectionLoadingOverlay from "./components/SectionLoadingOverlay";
import CartDrawer from "./components/CartDrawer";
import CheckoutStepper from "./components/CheckoutStepper";
import UserDashboard from "./components/UserDashboard";
import LoginRequiredModal from "./components/LoginRequiredModal";
import PhoneRequiredModal from "./components/PhoneRequiredModal";
import { useAuth } from "./hooks/useAuth";
import { useCartManager } from "./hooks/useCartManager";
import SplashScreen from "./components/SplashScreen";
import { isValidPhone, getStoredPhone, getPhoneLast10 } from "./lib/phone";
import { DEFAULT_SIZE_LABEL } from "./lib/productSizes";
import { getCaloriesForSize } from "./lib/productCalories";
import { getGramsForSize } from "./lib/productPortions";
import { reconcileCartWithMenu } from "./lib/checkoutPricingShared";
import { CONTACT_EMAIL, getPublicContactLocationLabel, getPublicContactMapLink } from "./lib/contactInfo";
import { getHeroVideoUrl } from "./lib/heroMedia";
import HeroVideo from "./components/HeroVideo";
import HeroBrandLogo from "./components/HeroBrandLogo";
import { BRAND_LOGO, HERO_FALLBACK_IMAGE } from "./lib/productImages";
import SafeImage from "./components/SafeImage";
import HeroInteractiveText from "./components/HeroInteractiveText";
import BrandName from "./components/BrandName";
import { ContactPhoneIconLink, ContactInstagramIconLink, ContactEmailIconLink } from "./components/ContactIconLinks";
import SplashBrandTitle from "./components/SplashBrandTitle";
import { parseJsonResponse } from "./lib/fetchJson";
import { consumeOverlayPopStateSuppression } from "./lib/appBoot";
import { shouldRenderSplash, suppressSplashPermanently } from "./lib/splashSession";
import { notifyCartUpdate } from "./components/CartFloatingBar";
import { readUserCart, writeUserCart } from "./lib/userSessionStorage";
import {
  scrollToLandingSectionWithRetry,
  scrollToLandingSection,
  pushLandingSectionHistory,
  replaceLandingSectionHistory,
  readLandingSectionFromHistoryEvent,
  getLandingSectionFromLocation,
} from "./lib/scrollToSection";
import { OVERLAY_HISTORY_KEY } from "./lib/overlayHistory";
import {
  readCheckoutResumeDraft,
  clearCheckoutResumeDraft,
  buildCheckoutOrderSummary,
} from "./lib/checkoutResume";
import {
  consumeGuestCart,
  upsertGuestCartLine,
  consumePendingCartAction,
} from "./lib/pendingCartAction";
import { cacheMenuAllCount, cacheMenuPayload, readCachedMenuPayload, getMostOrderedMenuItems, getCachedMenuSkeletonCount, getCachedUpcomingMarqueeVisible, cacheUpcomingMarqueeVisible, getMenuCacheBustKey, DEFAULT_MENU_SKELETON_COUNT } from "./lib/menuCatalogSkeleton";
import { normalizeMenuCategory } from "./lib/addonHelpers";
import { isCaloriesDisplayEnabled, isGramsDisplayEnabled } from "./lib/settings";
import { resolveProductImage } from "./lib/productImages";

function readStoredNumber(key, fallback = 0) {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    isLoggedIn,
    isProfileComplete,
    needsPhone,
    clearNeedsPhone,
    refreshAuth,
  } = useAuth();

  // Navigation & View Toggles
  const [activeSection, setActiveSection] = useState("home");
  const [activeDashboard, setActiveDashboard] = useState(null); // 'user', null (main page)

  // Catalog state
  const [menuItems, setMenuItems] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [mostOrderedProductIds, setMostOrderedProductIds] = useState([]);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedOatsSub, setSelectedOatsSub] = useState("regular");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [favorites, setFavorites] = useState([]);

  // Cart & checkout state
  const requireLoginForAction = useCallback(() => {
    if (isProfileComplete) return true;
    if (!(isLoggedIn && needsPhone)) {
      setShowLoginModal(true);
    }
    return false;
  }, [isProfileComplete, isLoggedIn, needsPhone]);

  const {
    cart,
    setCart,
    cartOpen,
    setCartOpen,
    handleAddToCart,
    handleReplaceCartItem,
    handleUpdateQty,
    handleIncrementQty,
    handleDecrementQty,
    handleRemoveCartItem,
    buildCartLine,
    cartLineKey
  } = useCartManager({ isProfileComplete, requireLoginForAction });

  const [checkoutSummary, setCheckoutSummary] = useState(null); // null when not in checkout
  const [checkoutResumeDraft, setCheckoutResumeDraft] = useState(null);
  const [coinDiscountApplied, setCoinDiscountApplied] = useState(false);
  const [appAlert, setAppAlert] = useState(null);

  // User state
  const [userCoins, setUserCoins] = useState(0);
  const [orderHistory, setOrderHistory] = useState([]);
  const [syncedPhone, setSyncedPhone] = useState("");
  const [settings, setSettings] = useState(null);
  const [menuBootReady, setMenuBootReady] = useState(false);
  const [menuFetchSettled, setMenuFetchSettled] = useState(false);
  const [profileBootReady, setProfileBootReady] = useState(false);
  const [activeCoupons, setActiveCoupons] = useState([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSizeLabel, setSelectedSizeLabel] = useState(null);
  const [cartEditIndex, setCartEditIndex] = useState(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", notes: "" });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactError, setContactError] = useState("");
  const [bootVisible, setBootVisible] = useState(false);
  const [splashFade, setSplashFade] = useState(false);
  const [showTelugu, setShowTelugu] = useState(false);
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const [enableMouseEffects, setEnableMouseEffects] = useState(false);
  const [appBootComplete, setAppBootComplete] = useState(false);
  const [sectionLoadersReady, setSectionLoadersReady] = useState(false);
  const [menuSkeletonCount, setMenuSkeletonCount] = useState(DEFAULT_MENU_SKELETON_COUNT);
  const [reserveUpcomingMarquee, setReserveUpcomingMarquee] = useState(false);
  const [clientLayoutReady, setClientLayoutReady] = useState(false);
  const [menuSectionMinHeight, setMenuSectionMinHeight] = useState(null);
  const [loadingSectionId, setLoadingSectionId] = useState(null);

  const prevDashboardRef = useRef(activeDashboard);
  const prevCheckoutRef = useRef(checkoutSummary);
  const postCheckoutScrollRef = useRef(null);
  const pendingScrollSectionRef = useRef(null);
  const pendingScrollCleanupRef = useRef(null);
  const scrollRafRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const followerPosRef = useRef({ x: 0, y: 0 });
  const mouseFollowerElRef = useRef(null);
  const mouseGlowElRef = useRef(null);
  const lastMenuRefreshAtRef = useRef(0);
  const activeSectionRef = useRef(activeSection);
  const cartHydratedForUserRef = useRef(null);
  const loadingSectionStartedRef = useRef(0);
  const menuSectionRef = useRef(null);
  const menuHeightLockRef = useRef(null);
  const userCancelledAutoScrollRef = useRef(false);
  const initialUrlSectionScrollDoneRef = useRef(false);
  const isHistoryNavigationRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const selectedItemRef = useRef(null);
  const checkoutSummaryRef = useRef(null);
  const appBootCompleteRef = useRef(false);

  const MIN_SECTION_LOADER_MS = 400;
  const SPLASH_TELUGU_DELAY_MS = 180;
  const SPLASH_HOLD_AFTER_ANIMATION_MS = 220;
  const SPLASH_FADE_OUT_MS = 420;
  const SPLASH_MAX_WAIT_MS = 3200;
  const SECTIONS_WITH_LOADER = new Set(["home", "menu"]);

  const shouldRetrySectionScroll = useCallback(
    (sectionId) => sectionId !== "home" && sectionId !== "menu" && !menuBootReady,
    [menuBootReady]
  );

  const markSectionLoading = useCallback((sectionId) => {
    if (appBootCompleteRef.current) return;
    if (!SECTIONS_WITH_LOADER.has(sectionId)) return;
    loadingSectionStartedRef.current = Date.now();
    setLoadingSectionId(sectionId);
  }, []);

  const cancelPendingSectionScroll = useCallback(() => {
    pendingScrollSectionRef.current = null;
    if (pendingScrollCleanupRef.current) {
      pendingScrollCleanupRef.current();
      pendingScrollCleanupRef.current = null;
    }
  }, []);

  const beginLandingSectionScroll = (
    sectionId,
    { enableRetry = false, behavior = "smooth" } = {}
  ) => {
    pendingScrollSectionRef.current = sectionId;
    if (pendingScrollCleanupRef.current) {
      pendingScrollCleanupRef.current();
    }
    isAutoScrollingRef.current = true;
    window.setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, behavior === "auto" ? 400 : 900);
    pendingScrollCleanupRef.current = scrollToLandingSectionWithRetry(sectionId, {
      enableRetry,
      behavior,
      onComplete: () => {
        if (pendingScrollSectionRef.current === sectionId) {
          pendingScrollSectionRef.current = null;
        }
        pendingScrollCleanupRef.current = null;
      }
    });
  };

  const navigateToLandingSection = (sectionId, { updateHistory = true } = {}) => {
    userCancelledAutoScrollRef.current = false;
    setActiveDashboard(null);
    setActiveSection(sectionId);
    markSectionLoading(sectionId);

    if (updateHistory && !isHistoryNavigationRef.current) {
      pushLandingSectionHistory(sectionId);
    }
    isHistoryNavigationRef.current = false;

    if (sectionId === "home") {
      isAutoScrollingRef.current = true;
      window.setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 900);
      window.scrollTo({ top: 0, behavior: "smooth" });
      pendingScrollSectionRef.current = null;
      if (pendingScrollCleanupRef.current) {
        pendingScrollCleanupRef.current();
        pendingScrollCleanupRef.current = null;
      }
      return;
    }

    beginLandingSectionScroll(sectionId, { enableRetry: shouldRetrySectionScroll(sectionId) });
  };

  const heroVideoUrl = settings ? getHeroVideoUrl(settings) : "";
  const handleHeroVideoReady = useCallback(() => {
    setHeroVideoReady(true);
    setHeroVideoFailed(false);
  }, []);
  const handleHeroVideoFailed = useCallback(() => {
    setHeroVideoFailed(true);
    setHeroVideoReady(false);
  }, []);
  // Don't block first paint on the hero video — it can finish loading under/after splash.
  const pageBootReady = menuBootReady && profileBootReady;

  const isSectionDataReady = useCallback(
    (sectionId) => {
      switch (sectionId) {
        case "home":
          return heroVideoReady || heroVideoFailed;
        case "menu":
          return menuBootReady;
        default:
          return true;
      }
    },
    [heroVideoReady, heroVideoFailed, menuBootReady]
  );

  const isSectionLoading = useCallback(
    (sectionId) => {
      if (!SECTIONS_WITH_LOADER.has(sectionId)) return false;
      if (appBootComplete) return false;
      if (loadingSectionId === sectionId) return true;
      if (!sectionLoadersReady) return false;
      return !isSectionDataReady(sectionId);
    },
    [loadingSectionId, sectionLoadersReady, appBootComplete, isSectionDataReady]
  );

  const applyMenuPayload = (data) => {
    if (!data?.success || !Array.isArray(data.menu)) return false;
    setMenuItems(data.menu);
    setMenuCategories(Array.isArray(data.menuCategories) ? data.menuCategories : []);
    setMostOrderedProductIds(
      Array.isArray(data.mostOrderedProductIds) ? data.mostOrderedProductIds : []
    );
    setSettings(data.settings || {});
    setActiveCoupons(data.coupons || []);
    if (data.upcomingItems) {
      setUpcomingItems(data.upcomingItems);
      cacheUpcomingMarqueeVisible(data.upcomingItems.length > 0);
    }
    cacheMenuPayload(data);
    return true;
  };

  const applyProfilePayload = (data) => {
    if (!data?.success) return;
    const balance = Number(data.wallet?.balance) || 0;
    setUserCoins(balance);
    setOrderHistory(Array.isArray(data.orders) ? data.orders : []);
    if (data.wallet?.phone) {
      setSyncedPhone(data.wallet.phone);
      if (typeof window !== "undefined") {
        localStorage.setItem("theoh_phone", data.wallet.phone);
      }
    }
    if (Array.isArray(data.wallet?.favorites)) setFavorites(data.wallet.favorites);
    if (typeof window !== "undefined") {
      localStorage.setItem("theoh_coins", String(balance));
    }
  };

  const handlePhoneComplete = async (phone, saveData) => {
    if (saveData?.wallet) {
      applyProfilePayload({
        success: true,
        wallet: saveData.wallet,
        orders: saveData.orders || [],
      });
    } else if (phone && typeof window !== "undefined") {
      localStorage.setItem("theoh_phone", phone);
    }

    const result = await refreshAuth();
    if (result?.ok && !result.needsPhone) {
      clearNeedsPhone();
    }

    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      applyProfilePayload(await parseJsonResponse(res));
    } catch (err) {
      console.error("Failed to refresh profile after phone save:", err);
    }

    // Profile is complete after phone save — cart hydrate effect merges guest cart.
  };

  // Fetch menu and hydrate app before revealing the page
  useEffect(() => {
    let cancelled = false;

    async function fetchMenuOnly() {
      try {
        const res = await fetch("/api/menu", { cache: "no-store" });
        const data = await parseJsonResponse(res);
        if (!cancelled) applyMenuPayload(data);
      } catch (err) {
        console.error("Failed to load catalog menu:", err);
      }
    }

    async function bootstrapApp() {
      // Paint from cache immediately so splash can dismiss without waiting on the network.
      const cachedMenu = readCachedMenuPayload();
      if (cachedMenu && !cancelled) {
        applyMenuPayload({ success: true, ...cachedMenu });
        setMenuFetchSettled(true);
        setProfileBootReady(true);
      }

      try {
        const menuResult = await fetch("/api/menu", { cache: "no-store" }).then((res) =>
          parseJsonResponse(res)
        );

        if (cancelled) return;
        applyMenuPayload(menuResult);
      } catch (err) {
        console.error("App bootstrap failed:", err);
      } finally {
        if (!cancelled) {
          setMenuFetchSettled(true);
          setProfileBootReady(true);
          lastMenuRefreshAtRef.current = Date.now();
        }
      }
    }

    bootstrapApp();

    const MENU_REFRESH_COOLDOWN_MS = 60_000;
    const refreshMenuIfStale = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastMenuRefreshAtRef.current < MENU_REFRESH_COOLDOWN_MS) return;
      lastMenuRefreshAtRef.current = now;
      fetchMenuOnly();
    };

    const forceRefreshMenu = () => {
      // Clear this tab's menu cache only — do not re-broadcast localStorage bust
      // (that would ping-pong other tabs).
      try {
        sessionStorage.removeItem("theoh_menu_payload_v20");
        sessionStorage.removeItem("theoh_menu_payload_v19");
        sessionStorage.removeItem("theoh_menu_payload_v18");
        sessionStorage.removeItem("theoh_menu_payload_v17");
      } catch {
        // Ignore storage failures.
      }
      lastMenuRefreshAtRef.current = 0;
      fetchMenuOnly();
    };

    const handleMenuRefresh = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(refreshMenuIfStale, 250);
      }
    };

    const handleStorage = (event) => {
      if (event.key === getMenuCacheBustKey() && event.newValue) {
        forceRefreshMenu();
      }
    };

    const handleSameTabBust = () => {
      forceRefreshMenu();
    };

    document.addEventListener("visibilitychange", handleMenuRefresh);
    window.addEventListener("focus", refreshMenuIfStale);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("theoh-menu-cache-bust", handleSameTabBust);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleMenuRefresh);
      window.removeEventListener("focus", refreshMenuIfStale);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("theoh-menu-cache-bust", handleSameTabBust);
    };
  }, []);

  useLayoutEffect(() => {
    if (!menuFetchSettled || menuBootReady) return;

    const frameId = requestAnimationFrame(() => {
      setMenuBootReady(true);
      cacheMenuAllCount(menuItems);
    });

    return () => cancelAnimationFrame(frameId);
  }, [menuFetchSettled, menuItems, menuBootReady]);

  useEffect(() => {
    if (!loadingSectionId) return;
    if (!isSectionDataReady(loadingSectionId)) return;

    const elapsed = Date.now() - loadingSectionStartedRef.current;
    const delay = Math.max(0, MIN_SECTION_LOADER_MS - elapsed);
    const timer = window.setTimeout(() => {
      setLoadingSectionId(null);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    loadingSectionId,
    isSectionDataReady,
    heroVideoReady,
    heroVideoFailed,
    menuBootReady
  ]);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      cartHydratedForUserRef.current = null;
      setUserCoins(0);
      setOrderHistory([]);
      setSyncedPhone("");
      setCart([]);
      return;
    }

    if (!isProfileComplete) {
      cartHydratedForUserRef.current = null;
      return;
    }

    // Already hydrated for this user — only reconcile against latest menu.
    if (cartHydratedForUserRef.current === user.id) {
      if (!menuItems.length) return;
      setCart((prevCart) => {
        const source = prevCart.length ? prevCart : readUserCart(user.id);
        const reconciled = reconcileCartWithMenu(source, menuItems);
        return JSON.stringify(reconciled) === JSON.stringify(source) ? prevCart.length ? prevCart : source : reconciled;
      });
      return;
    }

    const storedCart = readUserCart(user.id);
    const guestCart = consumeGuestCart();
    const legacyPending = consumePendingCartAction();
    let merged = Array.isArray(storedCart) ? [...storedCart] : [];

    const mergeLine = (line) => {
      if (!line?.id) return;
      const key = `${Number(line.id)}|${line.sizeLabel || DEFAULT_SIZE_LABEL}|${JSON.stringify(line.selectedAddons || [])}`;
      const idx = merged.findIndex(
        (entry) =>
          `${Number(entry.id)}|${entry.sizeLabel || DEFAULT_SIZE_LABEL}|${JSON.stringify(entry.selectedAddons || [])}` ===
          key
      );
      if (idx > -1) {
        merged[idx] = {
          ...merged[idx],
          ...line,
          quantity: (merged[idx].quantity || 0) + (line.quantity || 1),
        };
      } else {
        merged.push(line);
      }
    };

    guestCart.forEach(mergeLine);

    if (legacyPending?.type === "add") {
      const item = legacyPending.item;
      const details = legacyPending.details;
      const source = details || item;
      if (item?.id && source?.inStock !== false && source?.in_stock !== false) {
        mergeLine({
          ...item,
          ...(details || {}),
          id: Number(item.id),
          price: parseFloat(source.price ?? item.price),
          sizeLabel: source.sizeLabel || item.sizeLabel || DEFAULT_SIZE_LABEL,
          selectedAddons: source.selectedAddons || [],
          addonsTotal: source.addonsTotal || 0,
          quantity: details ? source.quantity || 1 : 1,
        });
      }
    } else if (legacyPending?.type === "increment" && legacyPending.item?.id) {
      mergeLine({
        ...legacyPending.item,
        id: Number(legacyPending.item.id),
        price: parseFloat(legacyPending.price ?? legacyPending.item.price),
        sizeLabel: legacyPending.sizeLabel || DEFAULT_SIZE_LABEL,
        selectedAddons: legacyPending.selectedAddons || [],
        quantity: 1,
      });
    }

    const nextCart = menuItems.length ? reconcileCartWithMenu(merged, menuItems) : merged;
    writeUserCart(user.id, nextCart);
    cartHydratedForUserRef.current = user.id;
    setCart(nextCart);
    notifyCartUpdate();

    fetch("/api/user", { cache: "no-store" })
      .then((res) => parseJsonResponse(res))
      .then((data) => applyProfilePayload(data))
      .catch((err) => console.error("Failed to load authenticated profile:", err));
  }, [authLoading, isProfileComplete, user?.id, menuItems]);

  useEffect(() => {
    const clearSessionState = () => {
      setCart([]);
      setUserCoins(0);
      setOrderHistory([]);
      setSyncedPhone("");
      // Do not clear guest cart here — it must survive login/auth transitions.
      cartHydratedForUserRef.current = null;
    };
    window.addEventListener("theoh-session-cleared", clearSessionState);
    return () => window.removeEventListener("theoh-session-cleared", clearSessionState);
  }, []);

  useEffect(() => {
    if (!clientLayoutReady || typeof window === "undefined") return;
    if (initialUrlSectionScrollDoneRef.current || userCancelledAutoScrollRef.current) return;

    const section = getLandingSectionFromLocation();
    if (!section || section === "home") return;

    initialUrlSectionScrollDoneRef.current = true;
    setActiveSection(section);
    // Jump straight to the requested section (no home → scroll animation).
    beginLandingSectionScroll(section, { enableRetry: true, behavior: "auto" });
    replaceLandingSectionHistory(section);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once layout is ready for deep-links
  }, [clientLayoutReady]);

  useEffect(() => {
    if (!menuItems.length) return;
    setCart((prevCart) => {
      if (!prevCart.length) return prevCart;
      const reconciled = reconcileCartWithMenu(prevCart, menuItems);
      return JSON.stringify(reconciled) === JSON.stringify(prevCart) ? prevCart : reconciled;
    });
  }, [menuItems]);

  // Persist cart for the signed-in user only after phone is saved AND cart hydrated.
  useEffect(() => {
    if (!isProfileComplete || !user?.id) return;
    if (cartHydratedForUserRef.current !== user.id) return;
    writeUserCart(user.id, cart);
    notifyCartUpdate();
  }, [cart, isProfileComplete, user?.id]);

  useEffect(() => {
    const syncCartFromStorage = () => {
      if (!isProfileComplete || !user?.id) {
        setCart([]);
        return;
      }
      if (cartHydratedForUserRef.current !== user.id) return;
      const nextCart = readUserCart(user.id);
      setCart((prev) =>
        JSON.stringify(prev) === JSON.stringify(nextCart) ? prev : nextCart
      );
    };
    window.addEventListener("theoh-cart-update", syncCartFromStorage);
    return () => window.removeEventListener("theoh-cart-update", syncCartFromStorage);
  }, [isProfileComplete, user?.id]);

  useEffect(() => {
    if (!appBootComplete || !isProfileComplete) return;
    localStorage.setItem("theoh_coins", userCoins.toString());
  }, [userCoins, appBootComplete, isProfileComplete]);

  useEffect(() => {
    localStorage.setItem("theoh_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!appBootComplete || !isProfileComplete) return;
    localStorage.setItem("theoh_phone", syncedPhone);
  }, [syncedPhone, appBootComplete, isProfileComplete]);

  useEffect(() => {
    if (!appBootComplete || !isProfileComplete) return;
    localStorage.setItem("theoh_history", JSON.stringify(orderHistory));
  }, [orderHistory, appBootComplete, isProfileComplete]);

  // Handle dashboard/checkout resets scrolling (not URL deep-links or scroll-sync)
  useEffect(() => {
    const exitedDashboard = prevDashboardRef.current !== null && activeDashboard === null;

    prevDashboardRef.current = activeDashboard;
    prevCheckoutRef.current = checkoutSummary;

    if (activeDashboard !== null || checkoutSummary !== null) return;

    const scrollTarget =
      postCheckoutScrollRef.current || (exitedDashboard ? activeSectionRef.current : null);

    if (postCheckoutScrollRef.current) {
      postCheckoutScrollRef.current = null;
    }

    if (!scrollTarget || userCancelledAutoScrollRef.current) return;

    setActiveSection(scrollTarget);
    markSectionLoading(scrollTarget);
    beginLandingSectionScroll(scrollTarget, { enableRetry: shouldRetrySectionScroll(scrollTarget) });
  }, [activeDashboard, checkoutSummary]);

  const isLandingVisible = !activeDashboard && !checkoutSummary;

  // Splash only on first visit / reload — never on overlay back (see splashSession.js).
  // Deep-links (?section=menu|about|contact) skip splash and jump straight to that section.
  useLayoutEffect(() => {
    const sectionParam = new URLSearchParams(window.location.search).get("section");
    const section = sectionParam || "home";
    const isDeepLink = Boolean(sectionParam) && section !== "home";
    const playSplash = !isDeepLink && shouldRenderSplash();

    if (playSplash) {
      setBootVisible(true);
    } else {
      suppressSplashPermanently();
      setAppBootComplete(true);
      setSplashAnimationComplete(true);
      setShowTelugu(true);
      setHeroVideoFailed(true);
      setMenuFetchSettled(true);
      setProfileBootReady(true);
      setMenuBootReady(true);

      const cachedMenu = readCachedMenuPayload();
      if (cachedMenu) {
        applyMenuPayload({ success: true, ...cachedMenu });
      }
    }

    setMenuSkeletonCount(getCachedMenuSkeletonCount());
    setReserveUpcomingMarquee(getCachedUpcomingMarqueeVisible());
    setClientLayoutReady(true);

    if (isDeepLink) {
      setActiveSection(section);
      activeSectionRef.current = section;
      if (SECTIONS_WITH_LOADER.has(section) && playSplash) {
        loadingSectionStartedRef.current = Date.now();
        setLoadingSectionId(section);
      }
      // Instant jump before paint so users never see the hero first.
      scrollToLandingSection(section, { behavior: "auto" });
      replaceLandingSectionHistory(section);
    } else if (playSplash) {
      replaceLandingSectionHistory(section);
    }
    setSectionLoadersReady(true);
  }, []);

  useLayoutEffect(() => {
    const el = menuSectionRef.current;
    if (!el || !clientLayoutReady) return;

    if (!menuBootReady) {
      const height = el.offsetHeight;
      if (height > 0) {
        menuHeightLockRef.current = height;
        setMenuSectionMinHeight(height);
      }
      return;
    }

    const locked = menuHeightLockRef.current;
    if (!locked) return;

    let frameA = 0;
    let frameB = 0;
    frameA = requestAnimationFrame(() => {
      const current = el.offsetHeight;
      const stable = Math.max(locked, current);
      setMenuSectionMinHeight(stable);
      frameB = requestAnimationFrame(() => {
        setMenuSectionMinHeight(Math.max(stable, el.offsetHeight));
        requestAnimationFrame(() => {
          setMenuSectionMinHeight(null);
          menuHeightLockRef.current = null;
        });
      });
    });

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
    };
  }, [menuBootReady, menuSkeletonCount, menuItems.length, clientLayoutReady]);

  const handleSplashTypingComplete = useCallback(() => {
    setShowTelugu(true);
    window.setTimeout(() => {
      setSplashAnimationComplete(true);
    }, SPLASH_TELUGU_DELAY_MS + SPLASH_HOLD_AFTER_ANIMATION_MS);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "true" || params.get("signin") === "true") {
      setShowLoginModal(true);
    }
  }, []);

  // Hard cap so a slow network never leaves the first loader on screen too long.
  useEffect(() => {
    if (!bootVisible) return undefined;
    const timer = window.setTimeout(() => {
      setMenuFetchSettled(true);
      setProfileBootReady(true);
      setMenuBootReady(true);
      setSplashAnimationComplete(true);
      setShowTelugu(true);
    }, SPLASH_MAX_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [bootVisible]);

  useEffect(() => {
    if (!pageBootReady || !bootVisible || !splashAnimationComplete) return;

    suppressSplashPermanently();
    setSplashFade(true);
    const fadeTimer = setTimeout(() => {
      setBootVisible(false);
      setAppBootComplete(true);
    }, SPLASH_FADE_OUT_MS);

    return () => clearTimeout(fadeTimer);
  }, [pageBootReady, bootVisible, splashAnimationComplete]);

  useEffect(() => {
    const handlePageShow = (event) => {
      if (!event.persisted) return;
      suppressSplashPermanently();
      setBootVisible(false);
      setAppBootComplete(true);
      setSplashAnimationComplete(true);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    appBootCompleteRef.current = appBootComplete;
  }, [appBootComplete]);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  // Keep open product details in sync with latest category visibility flags from menu.
  useEffect(() => {
    if (!selectedItem || !menuItems.length) return;
    const fresh = menuItems.find((m) => Number(m.id) === Number(selectedItem.id));
    if (!fresh) return;
    if (
      fresh.showNutrients !== selectedItem.showNutrients ||
      fresh.showIngredients !== selectedItem.showIngredients ||
      fresh.showCalories !== selectedItem.showCalories ||
      fresh.showGrams !== selectedItem.showGrams
    ) {
      setSelectedItem(fresh);
    }
  }, [menuItems, selectedItem]);

  useEffect(() => {
    checkoutSummaryRef.current = checkoutSummary;
  }, [checkoutSummary]);

  useEffect(() => {
    let cancelled = false;
    let popStateTimer = null;

    const cancelAutoScrollOnUserInput = () => {
      userCancelledAutoScrollRef.current = true;
      cancelPendingSectionScroll();
    };

    const cancelAutoScrollOnKey = (event) => {
      if (
        ["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(event.key)
      ) {
        cancelAutoScrollOnUserInput();
      }
    };

    const applyPopState = (event) => {
      if (cancelled) return;

      if (consumeOverlayPopStateSuppression()) {
        suppressSplashPermanently();
        setBootVisible(false);
        setAppBootComplete(true);
        setSplashAnimationComplete(true);
        return;
      }

      if (event.state?.[OVERLAY_HISTORY_KEY]) {
        return;
      }

      // Overlay back (product details, checkout steps) — overlay handler already closed UI.
      if (selectedItemRef.current || checkoutSummaryRef.current) {
        suppressSplashPermanently();
        setBootVisible(false);
        return;
      }

      const section = readLandingSectionFromHistoryEvent(event);
      isHistoryNavigationRef.current = true;
      userCancelledAutoScrollRef.current = true;
      cancelPendingSectionScroll();
      setActiveDashboard(null);
      setActiveSection(section);

      if (section === "home") {
        isAutoScrollingRef.current = true;
        window.setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 300);
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      isAutoScrollingRef.current = true;
      window.setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 300);
      scrollToLandingSection(section, { behavior: "auto" });
    };

    const handlePopState = (event) => {
      // Trackpad back/forward can fire rapid popstate — coalesce to one update.
      if (popStateTimer) window.clearTimeout(popStateTimer);
      const snapshot = { state: event.state };
      popStateTimer = window.setTimeout(() => applyPopState(snapshot), 40);
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("wheel", cancelAutoScrollOnUserInput, { passive: true });
    window.addEventListener("touchstart", cancelAutoScrollOnUserInput, { passive: true });
    window.addEventListener("keydown", cancelAutoScrollOnKey);

    return () => {
      cancelled = true;
      if (popStateTimer) window.clearTimeout(popStateTimer);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("wheel", cancelAutoScrollOnUserInput);
      window.removeEventListener("touchstart", cancelAutoScrollOnUserInput);
      window.removeEventListener("keydown", cancelAutoScrollOnKey);
    };
  }, [cancelPendingSectionScroll]);

  useEffect(() => {
    const syncActiveSectionFromScroll = () => {
      const scrollPos = window.scrollY + 200;
      const sections = ["home", "menu", "about", "contact"];
      let nextSection = activeSectionRef.current;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            nextSection = section;
            break;
          }
        }
      }

      if (nextSection !== activeSectionRef.current) {
        activeSectionRef.current = nextSection;
        setActiveSection(nextSection);
      }
    };

    const handleScroll = () => {
      if (!isAutoScrollingRef.current && pendingScrollCleanupRef.current) {
        userCancelledAutoScrollRef.current = true;
        cancelPendingSectionScroll();
      }

      if (scrollRafRef.current !== null) return;

      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        syncActiveSectionFromScroll();
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncActiveSectionFromScroll();
      }
    };

    const handleMouseMove = (e) => {
      if (selectedItemRef.current || checkoutSummaryRef.current) return;
      mousePosRef.current.x = e.clientX;
      mousePosRef.current.y = e.clientY;
    };

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isMobileViewport = window.innerWidth <= 768;
    const shouldEnableMouseEffects = !prefersReducedMotion && !isCoarsePointer && !isMobileViewport;
    setEnableMouseEffects(shouldEnableMouseEffects);

    syncActiveSectionFromScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pageshow", syncActiveSectionFromScroll);
    document.addEventListener("visibilitychange", handleVisibility);
    if (shouldEnableMouseEffects) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
    }

    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pageshow", syncActiveSectionFromScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Cursor glow/follower — DOM only (never setState in rAF; that froze the page on 2nd swipe).
  useEffect(() => {
    if (!enableMouseEffects) return undefined;

    let frameId = 0;
    let running = true;

    const tick = () => {
      if (!running) return;

      const overlaysOpen = Boolean(selectedItemRef.current || checkoutSummaryRef.current);
      const followerEl = mouseFollowerElRef.current;
      const glowEl = mouseGlowElRef.current;

      if (overlaysOpen || document.visibilityState !== "visible") {
        if (followerEl) followerEl.style.opacity = "0";
        if (glowEl) glowEl.style.opacity = "0";
      } else {
        const target = mousePosRef.current;
        const follower = followerPosRef.current;
        follower.x += (target.x - follower.x) * 0.12;
        follower.y += (target.y - follower.y) * 0.12;

        if (followerEl) {
          followerEl.style.opacity = "1";
          followerEl.style.left = `${follower.x}px`;
          followerEl.style.top = `${follower.y}px`;
        }
        if (glowEl) {
          glowEl.style.opacity = "1";
          glowEl.style.left = `${target.x}px`;
          glowEl.style.top = `${target.y}px`;
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frameId);
    };
  }, [enableMouseEffects]);

  // Cart operations handled by useCartManager

  // Favorites toggle
  const handleToggleFavorite = (id) => {
    setFavorites((prev) => {
      const newFavs = prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id];
      if (syncedPhone) {
        fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: syncedPhone,
            favorites: newFavs
          })
        }).catch(err => console.error("Error updating favorites in DB:", err));
      }
      return newFavs;
    });
  };

  // Stepper success operations
  const refreshOrderHistoryAfterCheckout = (phone, expectedOrderId = null, attempt = 0) => {
    const active = getPhoneLast10(phone);
    if (!isValidPhone(active)) return;

    fetch(`/api/user?phone=${encodeURIComponent(active)}`, { cache: "no-store" })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!data.success) return;

        const orders = data.orders || [];
        setUserCoins(data.wallet.balance);
        setOrderHistory(orders);
        setSyncedPhone(active);
        if (typeof window !== "undefined") {
          localStorage.setItem("theoh_history", JSON.stringify(orders));
          localStorage.setItem("theoh_phone", active);
        }

        if (expectedOrderId && attempt < 5) {
          const found = orders.some((order) => String(order.id) === String(expectedOrderId));
          if (!found) {
            setTimeout(
              () => refreshOrderHistoryAfterCheckout(active, expectedOrderId, attempt + 1),
              600 + attempt * 400
            );
          }
        }
      })
      .catch((err) => {
        console.error("Failsafe: error fetching profile after order:", err);
        if (attempt < 3) {
          setTimeout(
            () => refreshOrderHistoryAfterCheckout(active, expectedOrderId, attempt + 1),
            800
          );
        }
      });
  };

  const handleOrderConfirmed = (orderId, grandTotal, phone = "") => {
    setCart([]);
    const active = getPhoneLast10(phone || syncedPhone || getStoredPhone());
    if (!isValidPhone(active)) return;
    refreshOrderHistoryAfterCheckout(active, orderId);
  };

  const handleCheckoutClose = () => {
    setCheckoutSummary(null);
    setCheckoutResumeDraft(null);
    setCoinDiscountApplied(false);
    clearCheckoutResumeDraft();
  };

  const handleAddMoreItems = () => {
    postCheckoutScrollRef.current = "menu";
    setCheckoutSummary(null);
    setActiveSection("menu");
    pushLandingSectionHistory("menu");
    requestAnimationFrame(() => {
      scrollToLandingSection("menu", { behavior: "smooth" });
    });
  };

  useEffect(() => {
    const draft = readCheckoutResumeDraft();
    if (!draft?.awaitResume || checkoutSummary) return;

    const cartTotalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartTotalQty <= (draft.cartTotalQty || 0)) return;

    if (draft.source === "cart") {
      router.push("/cart");
      return;
    }

    clearCheckoutResumeDraft();
    setCoinDiscountApplied(Boolean(draft.coinDiscountApplied));
    setCheckoutResumeDraft(draft);
    setCheckoutSummary(
      buildCheckoutOrderSummary({
        cart,
        settings: settings || {},
        userCoins,
        coinDiscountApplied: Boolean(draft.coinDiscountApplied),
        promoDiscountPercent: (draft.localPromoPercent || 0) * 100,
        isProfileComplete,
      })
    );
  }, [cart, checkoutSummary, settings, userCoins, isProfileComplete, router]);

  const requestCheckout = (summary) => {
    if (!isProfileComplete) {
      if (!isLoggedIn) {
        setPendingCheckout(summary);
        setShowLoginModal(true);
      }
      return;
    }
    setCheckoutSummary(summary);
  };

  const handleLoginSuccess = async (_user, options = {}) => {
    setShowLoginModal(false);

    const result = await refreshAuth();
    if (!result?.ok || result.needsPhone || options.needsPhone) {
      setPendingCheckout(null);
      return;
    }

    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      const data = await parseJsonResponse(res);
      applyProfilePayload(data);
    } catch (err) {
      console.error("Failed to refresh profile after login:", err);
    }

    // Guest cart is merged by the profile-complete hydrate effect.
    if (pendingCheckout) {
      setCheckoutSummary(pendingCheckout);
      setPendingCheckout(null);
    }
  };


  // Filtering Menu
  // Show Menu ON  → category items appear anywhere in the Menu (All / tabs / Most Ordered / Favorites)
  // Show Menu OFF → category items are hidden completely from the storefront
  // Category Title ON → category tab appears in the Menu filters
  const menuCatalogItems = menuItems.filter((item) => item.showInMenu !== false);

  const titledMenuCategories = (menuCategories || []).filter(
    (category) => category.showSection && category.showInMenu !== false
  );

  const menuTabCategories = [
    "All",
    ...titledMenuCategories.map((category) => category.rawName || category.name),
    "Most Ordered",
    "Favorites",
  ];

  useEffect(() => {
    if (!menuTabCategories.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [menuTabCategories, selectedCategory]);

  const itemsForCategoryLabel = (label) => {
    const match = titledMenuCategories.find(
      (category) => (category.rawName || category.name) === label
    );
    return menuCatalogItems.filter((item) => {
      if (match?.id != null && item.categoryId != null) {
        return Number(item.categoryId) === Number(match.id);
      }
      const itemLabel = item.categoryRaw || item.category;
      return (
        normalizeMenuCategory(itemLabel) === normalizeMenuCategory(label) ||
        itemLabel === label
      );
    });
  };

  const filteredMenuItems =
    selectedCategory === "Most Ordered"
      ? getMostOrderedMenuItems(menuCatalogItems, mostOrderedProductIds)
      : selectedCategory === "Favorites"
      ? menuCatalogItems.filter((item) => favorites.includes(item.id))
      : selectedCategory === "All"
      ? menuCatalogItems
      : itemsForCategoryLabel(selectedCategory);

  const displayMenuItemsTemp =
    selectedCategory === "Oats"
      ? filteredMenuItems.filter((item) => {
          const sub = item.subCategory || "regular";
          return sub === selectedOatsSub;
        })
      : filteredMenuItems;

  const displayMenuItems = displayMenuItemsTemp.filter((item) => {
    if (!menuSearchQuery.trim()) return true;
    const q = menuSearchQuery.toLowerCase();
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  const getCatalogEmptyMessage = () => {
    if (menuBootReady && menuItems.length === 0) {
      return "Menu is temporarily unavailable. Please refresh the page.";
    }
    return "You can try that for the next order.";
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactError("");

    if (!contactForm.name.trim() || !contactForm.email.trim()) {
      setContactError("Please enter your name and email.");
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
          message: contactForm.notes.trim()
        })
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setContactSubmitted(true);
        setContactForm({ name: "", email: "", notes: "" });
        setTimeout(() => setContactSubmitted(false), 5000);
      } else {
        setContactError(data.error || "Failed to submit inquiry. Please try again.");
      }
    } catch (err) {
      console.error("Failed to submit contact:", err);
      setContactError("Connection error. Please try again.");
    }
  };

  return (
    <div className="app-container">
      {/* Splash Screen Loader */}
      <SplashScreen
        bootVisible={bootVisible}
        splashFade={splashFade}
        showTelugu={showTelugu}
        onTypingComplete={handleSplashTypingComplete}
      />

      {enableMouseEffects && (
        <>
          <div ref={mouseFollowerElRef} className="mouse-follower" aria-hidden="true" />
          <div ref={mouseGlowElRef} className="mouse-glow" aria-hidden="true" />
        </>
      )}

      {/* Global Navbar */}
      <Navbar 
        onCartToggle={() => setCartOpen(!cartOpen)} 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onDashboardToggle={setActiveDashboard}
        activeDashboard={activeDashboard}
        userCoins={userCoins}
        coinsLoading={bootVisible}
        isLoggedIn={isLoggedIn}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onSectionNavigate={navigateToLandingSection}
      />

      {/* RENDER ACTIVE DASHBOARDS (IF TOGGLED) */}
      {activeDashboard === "user" ? (
        <main className="section-padding" style={{ marginTop: "80px" }}>
          <UserDashboard 
            userCoins={userCoins} 
            orderHistory={orderHistory} 
            onFetchProfile={(coins, history, phone, dbFavorites) => {
              setUserCoins(coins);
              setOrderHistory(history);
              setSyncedPhone(phone);
              if (dbFavorites) setFavorites(dbFavorites);
            }}
            activePhone={syncedPhone}
          />
        </main>
      ) : checkoutSummary ? (
        /* CHECKOUT STEPPER SCREEN */
        <main className="section-padding checkout-page-main" style={{ background: "linear-gradient(135deg, #FAF8F5 0%, #F5F1EB 100%)", minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckoutStepper 
            orderSummary={checkoutSummary}
            cartItems={cart}
            onOrderSuccess={handleOrderConfirmed}
            onClose={handleCheckoutClose}
            onAddMoreItems={handleAddMoreItems}
            checkoutSource="home"
            resumeDraft={checkoutResumeDraft}
            onResumeConsumed={() => setCheckoutResumeDraft(null)}
            addUserCoins={(coins) => setUserCoins(prev => prev + coins)}
            onViewDashboard={() => setActiveDashboard("user")}
            onNavigateAfterSuccess={(target) => {
              handleCheckoutClose();
              if (target === "history") {
                window.location.href = "/profile";
                return;
              }
              setActiveSection("menu");
              requestAnimationFrame(() => {
                const menuSection = document.getElementById("menu");
                if (menuSection) {
                  window.scrollTo({
                    top: menuSection.offsetTop - 80,
                    behavior: "smooth"
                  });
                }
              });
            }}
            settings={settings || {}}
            syncedPhone={syncedPhone}
            activeCoupons={activeCoupons}
            menuItems={menuItems}
            onAddToCart={handleAddToCart}
            onUpdateCartItem={handleReplaceCartItem}
            onRemoveCartItem={handleRemoveCartItem}
            userCoins={userCoins}
          />
        </main>
      ) : (
        /* MAIN LANDING SITE */
        <main>
          {/* SECTION 1: HERO SECTION */}
          <section id="home" className="hero-section landing-section-shell">
            <SectionLoadingOverlay loading={isSectionLoading("home")} variant="dark" label="Loading home" />
            <div className="hero-video-stage">
              <HeroVideo
                videoUrl={heroVideoUrl}
                fallbackPoster={HERO_FALLBACK_IMAGE}
                onReady={handleHeroVideoReady}
                onFailed={handleHeroVideoFailed}
                active={isLandingVisible}
              />
            </div>

            <HeroBrandLogo />

            <div className="hero-grid">
              <HeroInteractiveText
                onCustomizeBowl={() => {
                  setSelectedCategory("Customize");
                  navigateToLandingSection("menu");
                }}
                onDiscoverCraft={() => navigateToLandingSection("about")}
              />

              <div className="hero-right" aria-hidden="true" />
            </div>
          </section>

          {/* UPCOMING ITEMS MARQUEE */}
          <div
            className="upcoming-marquee-slot"
            style={
              clientLayoutReady && reserveUpcomingMarquee && !menuBootReady
                ? { minHeight: "280px" }
                : undefined
            }
            aria-hidden={
              clientLayoutReady && reserveUpcomingMarquee && !menuBootReady ? true : undefined
            }
          >
            {menuBootReady && upcomingItems && upcomingItems.length > 0 && (
            <section className="upcoming-marquee-section" style={{ marginTop: '0', paddingBottom: '30px' }}>
              <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                <h3 className="upcoming-marquee-title">
                  Coming Soon to <BrandName />
                </h3>
                <div style={{ width: '60px', height: '3px', background: 'var(--accent-gold)', margin: '10px auto 0' }}></div>
              </div>
              <div className="marquee-container">
                <div className="marquee-track">
                  {[...upcomingItems, ...upcomingItems, ...upcomingItems, ...upcomingItems, ...upcomingItems].map((item, idx) => (
                    <div key={idx} className="upcoming-item-card">
                      <SafeImage
                        src={item.image}
                        category="Oats"
                        name={item.name}
                        alt={item.name}
                        className="upcoming-item-img"
                      />
                      <div className="upcoming-item-content">
                        <h4 className="upcoming-item-title">{item.name}</h4>
                        {item.description && <p className="upcoming-item-desc">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            )}
          </div>

          {/* SECTION 3: MENU FILTER & PRODUCTS CATALOG */}
          <section
            ref={menuSectionRef}
            id="menu"
            className="menu-section section-padding landing-section-shell landing-section-shell--menu"
            style={menuSectionMinHeight ? { minHeight: menuSectionMinHeight } : undefined}
          >
            <SectionLoadingOverlay loading={isSectionLoading("menu")} label="Loading menu" />
            <div className="landing-section-content">
            <div className="section-header catalog-section-header" style={{ textAlign: "left", alignItems: "flex-start", marginBottom: "30px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "15px" }}>
              <h2 className="catalog-title">Menu</h2>
              <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "30px", padding: "10px 20px", minWidth: "280px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted" style={{ marginRight: "10px", color: "#999" }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                  type="text" 
                  placeholder="Search our menu..." 
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  style={{ border: "none", background: "transparent", color: "#1a1a1a", outline: "none", width: "100%", fontSize: "15px", fontWeight: "500" }}
                />
              </div>
            </div>

            {/* Category selection tabs */}
            <div className="category-tabs-container">
              {menuTabCategories.map((category) => (
                <button
                  key={category}
                  className={`category-tab-btn ${selectedCategory === category ? "active" : ""}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                  {selectedCategory === category && <span className="tab-pill-indicator"></span>}
                </button>
              ))}
            </div>

            {/* Oats Sub-Category Buttons Type (tabs) */}
            {selectedCategory === "Oats" && (
              <div className="oats-sub-tabs-container animate-fade-in">
                <button
                  className={`oats-sub-tab-btn ${selectedOatsSub === "regular" ? "active" : ""}`}
                  onClick={() => setSelectedOatsSub("regular")}
                >
                  <Leaf size={14} className="sub-icon" />
                  Oat Bowls
                </button>
                <button
                  className={`oats-sub-tab-btn signature ${selectedOatsSub === "oats signature" ? "active" : ""}`}
                  onClick={() => setSelectedOatsSub("oats signature")}
                >
                  <Sparkles size={14} className="sub-icon" />
                  Signature Collection
                </button>
              </div>
            )}

            {/* Catalog Grid */}
            <div
              className={`catalog-products-grid ${selectedCategory === "Oats" ? "animate-fade-in" : ""}`}
            >
              {!menuBootReady ? (
                <MenuCatalogSkeleton count={menuSkeletonCount} />
              ) : displayMenuItems.length === 0 ? (
                <div className="catalog-empty-state">
                  <p className="catalog-empty-title">No items</p>
                  <p className="catalog-empty-desc">There are currently no items available in this category.</p>
                </div>
              ) : (
                displayMenuItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    onQuickView={(item, options = {}) => {
                      suppressSplashPermanently();
                      if (
                        activeSectionRef.current === "menu" &&
                        !window.history.state?.[OVERLAY_HISTORY_KEY]
                      ) {
                        const urlSection = new URLSearchParams(window.location.search).get("section");
                        if (urlSection !== "menu") {
                          pushLandingSectionHistory("menu");
                        }
                      }
                      setCartEditIndex(null);
                      const latest =
                        menuItems.find((m) => Number(m.id) === Number(item.id)) || item;
                      setSelectedItem(latest);
                      setSelectedSizeLabel(options.sizeLabel || null);
                    }}
                    onAddToCart={handleAddToCart}
                    isFavorite={favorites.includes(item.id)}
                    onToggleFavorite={handleToggleFavorite}
                    cartLines={cart.filter((i) => Number(i.id) === Number(item.id))}
                    onIncrement={handleIncrementQty}
                    onDecrement={handleDecrementQty}
                  />
                ))
              )}
            </div>
            </div>
          </section>

          {/* SECTION 4: OUR STORY */}
          <section id="about" className="our-story-section section-padding landing-section-shell landing-section-shell--about">
            <div className="landing-section-content">
              <div className="our-story-grid">
                <div className="story-image-container reveal-fade-up">
                  <SafeImage
                    src="/our_craft_image.jpg"
                    alt="THE OH! Oats Bowl"
                    category="Our Story"
                    name="Our Craft"
                    className="story-image"
                  />
                </div>

                <div className="story-content reveal-fade-up" style={{ animationDelay: "100ms" }}>
                  <span className="story-subtitle">
                    <span style={{ fontFamily: 'var(--font-dream-avenue), "Dream Avenue", serif', fontSize: '1.2em', fontWeight: 'bold' }}>THE OH !</span> • OUR STORY
                  </span>
                  <h2 className="story-title">Two Brothers. One Mission. A Healthier Habit.</h2>
                  <div className="story-divider"></div>
                  
                  <p className="story-desc">
                    <span style={{ fontFamily: 'var(--font-dream-avenue), "Dream Avenue", serif', fontSize: '1.1em', fontWeight: 'bold', color: 'var(--primary-brand)' }}>THE OH !</span> began with a simple belief from two brothers, Sai Chandu and Sai Nandhu — healthy food should never feel boring.
                  </p>
                  <p className="story-desc">
                    Growing up, they saw how difficult it was for people to maintain nutritious eating habits in today's fast-paced lifestyle. They envisioned a brand that transforms oats into something people genuinely look forward to every day.
                  </p>
                  <p className="story-desc">
                    Every bowl at <span style={{ fontFamily: 'var(--font-dream-avenue), "Dream Avenue", serif', fontSize: '1.1em', fontWeight: 'bold', color: 'var(--primary-brand)' }}>THE OH !</span> is thoughtfully crafted using premium oats, fresh fruits, wholesome ingredients, and carefully selected toppings that deliver both exceptional taste and balanced nutrition.
                  </p>
                  <p className="story-desc">
                    For us, this is more than breakfast. It is about inspiring a healthier lifestyle, one bowl at a time.
                  </p>

                  <div className="founder-quote-card glass-effect">
                    <p className="quote-text">"We didn't just create an oats brand. We created a healthier habit people can fall in love with."</p>
                    <span className="quote-author">— Sai Chandu & Sai Nandhu</span>
                  </div>
                </div>
              </div>

              <div className="story-stats-grid reveal-fade-up" style={{ animationDelay: "200ms" }}>
                <div className="stat-card glass-effect">Premium Ingredients</div>
                <div className="stat-card glass-effect">Freshly Made Every Order</div>
                <div className="stat-card glass-effect">Healthy Lifestyle First</div>
                <div className="stat-card glass-effect">Crafted With Care</div>
              </div>
            </div>
          </section>

          {/* SECTION 5: RESERVATIONS / CONTACT CONCIERGE */}
          <section id="contact" className="contact-section section-padding landing-section-shell landing-section-shell--contact">
            <div className="landing-section-content">
            <div className="contact-grid">
              
              <div className="contact-details">
                <span className="section-subtitle">CONNECT WITH US</span>
                <h2 className="contact-title">
                  Speak to <BrandName />
                </h2>
                <p className="contact-intro">For orders, custom catering requests, or any questions, our team is ready to assist you.</p>
                
                <div className="contact-info-list">
                  <div className="contact-social-icons">
                    <ContactPhoneIconLink phone={settings?.restaurant_phone} className="contact-icon-link" size={18} />
                    <ContactInstagramIconLink className="contact-icon-link" size={18} />
                    <ContactEmailIconLink
                      email={settings?.restaurant_email || CONTACT_EMAIL}
                      className="contact-icon-link"
                      size={18}
                    />
                  </div>
                  <div className="info-row">
                    <MapPin size={18} className="icon-gold" />
                    <a
                      href={getPublicContactMapLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-location-link"
                      title={`View ${getPublicContactLocationLabel(settings)} on Google Maps`}
                      aria-label={`Open ${getPublicContactLocationLabel(settings)} in Google Maps`}
                    >
                      {getPublicContactLocationLabel(settings)}
                    </a>
                  </div>
                </div>
              </div>

              <div className="contact-form-box glass-effect">
                <h4>Send Us a Message</h4>
                {contactSubmitted ? (
                  <div className="form-success-alert">
                    <Sparkles size={20} className="icon-gold" />
                    <p>Message Received.</p>
                    <span>We will personally respond to you shortly.</span>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit}>
                    <div className="form-group-contact">
                      <label>Your Name</label>
                      <input 
                        type="text" 
                        required 
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group-contact">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        required 
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group-contact">
                      <label>Your Message</label>
                      <textarea 
                        rows="3" 
                        value={contactForm.notes}
                        onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                      Send Message <ArrowRight size={16} />
                    </button>
                    {contactError && (
                      <p style={{ color: "#ffcdd2", fontSize: "0.85rem", marginTop: "12px", textAlign: "center" }}>
                        {contactError}
                      </p>
                    )}
                  </form>
                )}
              </div>

            </div>
            </div>
          </section>
        </main>
      )}

      {!checkoutSummary && (
        <Footer
          onDashboardToggle={setActiveDashboard}
          setActiveSection={setActiveSection}
          onSectionNavigate={navigateToLandingSection}
        />
      )}

      {/* Side Cart Drawer */}
      <CartDrawer 
        isOpen={cartOpen} 
        onClose={() => setCartOpen(false)}
        onExploreMenu={() => {
          setCartOpen(false);
          setActiveDashboard(null);
          setActiveSection("menu");
          setTimeout(() => {
            const menuSection = document.getElementById("menu");
            if (menuSection) {
              window.scrollTo({
                top: menuSection.offsetTop - 80,
                behavior: "smooth"
              });
            }
          }, 100);
        }}
        cartItems={cart}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveCartItem}
        menuItems={menuItems}
        onViewCartItem={(idx) => {
          const line = cart[idx];
          const full = menuItems.find((m) => Number(m.id) === Number(line.id)) || line;
          setCartEditIndex(idx);
          setSelectedItem(full);
        }}
        userCoins={userCoins}
        onCheckoutTrigger={requestCheckout}
        coinDiscountApplied={coinDiscountApplied}
        setCoinDiscountApplied={setCoinDiscountApplied}
        settings={settings || {}}
      />

      {/* Quick View Item Details Modal */}
      {selectedItem && selectedItem.category_name === "Customize Your Bowl" ? (
        <BowlBuilderModal
          item={selectedItem}
          cartLine={cartEditIndex != null ? cart[cartEditIndex] : null}
          onClose={() => {
            suppressSplashPermanently();
            selectedItemRef.current = null;
            setSelectedItem(null);
            setSelectedSizeLabel(null);
            setCartEditIndex(null);
            setLoadingSectionId(null);
          }}
          onAddToCart={handleAddToCart}
          onUpdateCartLine={
            cartEditIndex != null
              ? (newLine) => handleUpdateCartLine(cartEditIndex, newLine)
              : null
          }
        />
      ) : selectedItem && (
        <ProductDetailsModal
          item={selectedItem}
          initialSizeLabel={selectedSizeLabel}
          cartLine={cartEditIndex != null ? cart[cartEditIndex] : null}
          showCalories={isCaloriesDisplayEnabled(settings || {})}
          showGrams={isGramsDisplayEnabled(settings || {})}
          onClose={() => {
            suppressSplashPermanently();
            selectedItemRef.current = null;
            setSelectedItem(null);
            setSelectedSizeLabel(null);
            setCartEditIndex(null);
            setLoadingSectionId(null);
          }}
          onAddToCart={handleAddToCart}
          onUpdateCartLine={
            cartEditIndex != null
              ? (updated) => {
                  handleReplaceCartItem(cartEditIndex, updated);
                  setSelectedItem(null);
                  setCartEditIndex(null);
                }
              : null
          }
        />
      )}

      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setPendingCheckout(null);
          // Keep guest cart so closing the login sheet does not lose the item.
        }}
        onAuthenticated={handleLoginSuccess}
        message="Sign in to add items to your cart and place orders."
      />

      <PhoneRequiredModal
        isOpen={isLoggedIn && needsPhone}
        onComplete={handlePhoneComplete}
      />

      {appAlert && (
        <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-content glass-effect" style={{ maxWidth: '400px', width: '90%', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', background: 'rgba(15,30,20,0.95)' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px', fontFamily: 'var(--font-title)' }}>Notification</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', marginBottom: '25px', lineHeight: '1.5' }}>
              {appAlert.message}
            </p>
            <button 
              onClick={() => {
                const cb = appAlert.onOk;
                setAppAlert(null);
                if (cb) cb();
              }} 
              className="btn-primary"
              style={{ padding: '8px 25px', borderRadius: '8px', border: 'none', background: 'var(--accent-gold)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

