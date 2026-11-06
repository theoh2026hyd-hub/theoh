"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { parseJsonResponse } from "../lib/fetchJson";
import { lookupAddonCalories } from "../lib/addonCalories";
import { ADDON_GROUP_CATEGORIES, isAddonGroupCategory } from "../lib/addonHelpers";
import { BRAND_LOGO, resolveProductImage } from "../lib/productImages";
import BrandName from "./BrandName";
import {
  normalizeSizeCaloriesInput,
  sanitizeSizeCaloriesInput,
  firstSizeCalorie,
} from "../lib/productCalories";
import {
  normalizeSizePricesInput,
  extractSizePricesRaw,
  sanitizeSizePricesInput,
  extractSizeGramsRaw,
  extractSizeCaloriesRaw,
  isCookiesCategory,
  isBreadsCategory,
  formatVisibleSizePrices,
  firstSizePrice,
} from "../lib/productSizes";
import { normalizeSizeGramsInput, sanitizeSizeGramsInput } from "../lib/productPortions";
import { getItemBaseName } from "../lib/cartDisplay";
import { formatOrderNumber } from "../lib/orderNumber";
import { clearMenuPayloadCache } from "../lib/menuCatalogSkeleton";
import {
  DEFAULT_DELIVERY_TIME_SLOTS,
  generateDeliveryTimeSlotsFromTimings,
  mergeSlotEnabledState,
  parseDeliveryTimeSlots,
  serializeDeliveryTimeSlots,
  parseDeliveryTimeSlotDateRules,
  serializeDeliveryTimeSlotDateRules,
  applyDateSlotOverrides,
  formatSlotRuleDateLabel,
  formatLocalDateYmd
} from "../lib/deliveryTimeSlots";
import { formatAdminDateTime } from "../lib/dates";
import { sanitizeOtpInput, otpFromClipboardEvent } from "../lib/otpInput";
import { DEFAULT_HERO_VIDEO_URL } from "../lib/heroMedia";
import {
  createDefaultSectionDateRanges,
  getDateRangeLabel,
  isValidDateRangeInput,
  resolveDateRangeBounds
} from "../lib/adminDateRange";
import {
  parseAdditionalRequests,
  parseScheduleFromInstructions,
  parsePickupTable,
  buildOrderEnjoyDetails
} from "../lib/orderEnjoyDetails";
import AdminDateRangeFilter from "./AdminDateRangeFilter";
import AdminBootLoader from "./AdminBootLoader";
import { useOverlayBack, backOverlayHistory } from "../lib/overlayHistory";
import ItemSizeBadge from "./ItemSizeBadge";
import ProductImageUpload from "./ProductImageUpload";
import LoadingButton from "./LoadingButton";
import FormModalCloseButton from "./FormModalCloseButton";
import { 
  IndianRupee, Inbox, Users, Plus, Check, ChevronRight, Trash2, 
  Settings, Award, Sparkles, LogOut, Lock, Search, Filter, 
  MapPin, Phone, User, Tag, ShoppingBag, Eye, EyeOff, Calendar, RefreshCw,
  Menu, X, MessageSquare, Clock
} from "lucide-react";

const formatPrice = (val) => {
  if (val === undefined || val === null) return "0.00";
  const num = parseFloat(val);
  return isNaN(num) ? "0.00" : num.toFixed(2);
};

const sanitizeDecimalInput = (value) => {
  let cleaned = String(value).replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, "");
  }
  return cleaned;
};

const formatAddressForDisplay = (addr) => {
  if (!addr || addr === "Not added" || addr === "No profile address saved") return "";
  if (addr.includes(" || Map: ")) return addr.split(" || Map: ")[0];
  return addr;
};

const getMapLinkFromAddress = (addr) => {
  if (!addr || addr === "Not added" || addr === "No profile address saved") return null;
  if (addr.includes(" || Map: ")) return addr.split(" || Map: ")[1];
  const display = formatAddressForDisplay(addr);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(display)}`;
};

const getEmbedUrlFromAddress = (addr) => {
  if (!addr || addr === "Not added" || addr === "No profile address saved") return "";
  if (addr.includes(" || Map: ")) {
    const mapLink = addr.split(" || Map: ")[1];
    const match = mapLink.match(/query=([^&]+)/);
    if (match) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(decodeURIComponent(match[1]))}&z=15&output=embed`;
    }
  }
  const display = formatAddressForDisplay(addr);
  if (!display) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(display)}&z=15&output=embed`;
};

function AdminAddressMapBlock({ address, compact = false }) {
  const displayAddr = formatAddressForDisplay(address);
  const mapLink = getMapLinkFromAddress(address);
  const embedUrl = getEmbedUrlFromAddress(address);

  if (!displayAddr) {
    return <span style={{ color: "rgba(255,255,255,0.4)" }}>Not added</span>;
  }

  return (
    <div>
      <span style={{ color: "#ffffff" }}>{displayAddr}</span>
      {mapLink && (
        <div style={{ marginTop: "8px" }}>
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#d4af37",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "12px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(212, 175, 55, 0.4)",
              background: "rgba(212, 175, 55, 0.1)"
            }}
          >
            <MapPin size={14} /> Open in Google Maps
          </a>
        </div>
      )}
      {embedUrl && (
        <div
          style={{
            width: "100%",
            height: compact ? "120px" : "160px",
            borderRadius: "8px",
            overflow: "hidden",
            marginTop: "10px",
            border: "1px solid rgba(255,255,255,0.15)"
          }}
        >
          <iframe
            title="Customer address map"
            width="100%"
            height="100%"
            frameBorder="0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={embedUrl}
            style={{ border: 0 }}
          />
        </div>
      )}
    </div>
  );
}

const isPendingOrderStatus = (status) => {
  const s = (status || "").toLowerCase();
  return s !== "delivered & plated" && s !== "delivered" && s !== "cancelled";
};

const ADMIN_TAB_SESSION_KEY = "theoh_admin_tab_session";
const ADMIN_OTP_DRAFT_KEY = "theoh_admin_otp_draft";

function readOtpDraft() {
  try {
    const raw = sessionStorage.getItem(ADMIN_OTP_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft?.email || !draft?.expiresAt) return null;
    if (Date.now() >= Number(draft.expiresAt)) {
      sessionStorage.removeItem(ADMIN_OTP_DRAFT_KEY);
      return null;
    }
    return draft;
  } catch (_) {
    return null;
  }
}

function writeOtpDraft(email, expiresAt) {
  try {
    sessionStorage.setItem(
      ADMIN_OTP_DRAFT_KEY,
      JSON.stringify({ email, expiresAt: Number(expiresAt), otpSent: true })
    );
  } catch (_) {}
}

function clearOtpDraft() {
  try {
    sessionStorage.removeItem(ADMIN_OTP_DRAFT_KEY);
  } catch (_) {}
}

export default function AdminDashboard({ 
  activeOrders = [], 
  dashboardOrders = [],
  stats = null,
  ordersStats = null,
  logs = [],
  categories = [],
  products = [],
  addons = [],
  coupons = [],
  customers = [],
  payments = [],
  settings = {},
  updates = [],
  events = [],
  upcomingItems = [],
  contacts = [],
  onUpdateOrderStatus,
  onRefreshData,
  isSyncing = false,
  adminBootReady = true,
  onAuthChange
}) {
  // Email OTP Authentication State
  const [adminEmail, setAdminEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, orders, products, categories, addons, offers, coupons, coins, customers, payments, analytics, settings, updates, events
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appAlert, setAppAlert] = useState(null);
  const [appConfirm, setAppConfirm] = useState(null);
  const alert = (message) => setAppAlert({ message });

  // Search and Filter States
  const [orderFilter, setOrderFilter] = useState("All"); // All, Pending, Delivered, Cancelled
  const [orderSearch, setOrderSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [addonSearch, setAddonSearch] = useState("");
  const [addonCategoryFilter, setAddonCategoryFilter] = useState("all");
  const [couponSearch, setCouponSearch] = useState("");
  const [coinSearch, setCoinSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [updateSearch, setUpdateSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [sectionDateRanges, setSectionDateRanges] = useState(createDefaultSectionDateRanges);

  // Modal / Detail views state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomerFields, setEditingCustomerFields] = useState(null); // null or { phone, name, address }

  // Form states for CRUD
  const [productForm, setProductForm] = useState(null); // null or { mode: 'create'|'edit', id?: number, name, price, category_id, calories, rating, description, image, in_stock }
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [categoryForm, setCategoryForm] = useState(null); // null or { mode: 'create'|'edit', id?: number, name }
  const [addonForm, setAddonForm] = useState(null); // null or { mode: 'create'|'edit', id?: number, product_id, name, price }
  const [couponForm, setCouponForm] = useState(null); // null or { mode: 'create'|'edit', code?: string, discount_percent, is_active, phone_restriction }
  const [coinAdjustForm, setCoinAdjustForm] = useState(null); // null or { phone, actionType: 'add'|'remove'|'reset', amount: 100 }
  const [updateForm, setUpdateForm] = useState(null); // null or { mode: 'create'|'edit', id?: number, title, subtitle, content, tag, image_url }
  const [eventForm, setEventForm] = useState(null); // null or { mode: 'create'|'edit', id?: number, title, location, event_date, description, requires_registration, image_url }
  const [upcomingItemForm, setUpcomingItemForm] = useState(null); // null or { mode: 'create'|'edit', id?: number, name, description, image }
  const [upcomingImageUploading, setUpcomingImageUploading] = useState(false);
  const [selectedEventRegs, setSelectedEventRegs] = useState(null); // null or { eventTitle, list: [] }
  const [actionLoading, setActionLoading] = useState(null);
  const deepLinkOrderHandledRef = useRef(false);

  const closeAllAdminOverlays = useCallback(() => {
    setProductImageUploading(false);
    setProductForm(null);
    setCategoryForm(null);
    setAddonForm(null);
    setCouponForm(null);
    setCoinAdjustForm(null);
    setUpdateForm(null);
    setEventForm(null);
    setUpcomingImageUploading(false);
    setUpcomingItemForm(null);
    setSelectedOrder(null);
    setSelectedCustomer(null);
    setEditingCustomerFields(null);
    setSelectedEventRegs(null);
  }, []);

  const dismissAdminOverlay = () => {
    if (!backOverlayHistory()) {
      closeAllAdminOverlays();
    }
  };

  const activeAdminOverlay = useMemo(() => {
    if (productForm) return "admin-product-form";
    if (categoryForm) return "admin-category-form";
    if (addonForm) return "admin-addon-form";
    if (couponForm) return "admin-coupon-form";
    if (coinAdjustForm) return "admin-coin-form";
    if (updateForm) return "admin-update-form";
    if (eventForm) return "admin-event-form";
    if (upcomingItemForm) return "admin-upcoming-form";
    if (selectedOrder) return "admin-order-detail";
    if (selectedCustomer) return "admin-customer-detail";
    if (selectedEventRegs) return "admin-event-regs";
    return null;
  }, [
    productForm,
    categoryForm,
    addonForm,
    couponForm,
    coinAdjustForm,
    updateForm,
    eventForm,
    upcomingItemForm,
    selectedOrder,
    selectedCustomer,
    selectedEventRegs,
  ]);

  useOverlayBack(Boolean(activeAdminOverlay), activeAdminOverlay, closeAllAdminOverlays);

  // Local copy of products for optimistic stock / menu toggles
  const [localProducts, setLocalProducts] = useState(products);
  useEffect(() => {
    setLocalProducts(
      (products || []).map((product) => ({
        ...product,
        show_in_menu: product.show_in_menu !== false,
      }))
    );
  }, [products]);

  const [localCategories, setLocalCategories] = useState(categories);
  useEffect(() => {
    setLocalCategories(
      (categories || []).map((category) => {
        const showInMenu = category.show_in_menu !== false;
        return {
          ...category,
          show_in_menu: showInMenu,
          // Menu OFF ⇒ Title OFF in admin UI
          show_section: showInMenu && Boolean(category.show_section),
          show_calories: category.show_calories !== false,
          show_grams: category.show_grams !== false,
          show_ingredients: category.show_ingredients !== false,
          show_nutrients: category.show_nutrients !== false,
        };
      })
    );
  }, [categories]);

  const [localAddons, setLocalAddons] = useState(addons);
  useEffect(() => {
    setLocalAddons(
      (addons || []).map((addon) => ({
        ...addon,
        is_active: addon.is_active !== false,
      }))
    );
  }, [addons]);

  const statsPeriodLabel = getDateRangeLabel(sectionDateRanges.dashboard, stats);

  const updateSectionDateRange = (section, patch) => {
    setSectionDateRanges((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch }
    }));
  };

  const applySectionDateRange = (section, overrideRange = null) => {
    if (!onRefreshData) return;
    const safeOverride = isValidDateRangeInput(overrideRange) ? overrideRange : null;
    const range = safeOverride || sectionDateRanges[section];
    if (safeOverride) {
      setSectionDateRanges((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...safeOverride }
      }));
    }
    onRefreshData(section, range);
  };

  const dateRangeSections = useMemo(
    () => new Set(["dashboard", "orders", "customers", "payments", "coins"]),
    []
  );
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    if (!isAuthenticated || !onRefreshData) return;
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    if (!dateRangeSections.has(activeTab)) return;
    
    const range = sectionDateRanges[activeTab] || { preset: "all", from: "", to: "" };
    onRefreshData(activeTab, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when switching tabs
  }, [activeTab, isAuthenticated, onRefreshData, dateRangeSections]);
  const [settingsState, setSettingsState] = useState({
    restaurant_name: "THE OH !",
    restaurant_phone: "+1 (800) 902-1402",
    restaurant_email: "concierge@theohreserve.com",
    restaurant_address: "Shibuya / NY",
    restaurant_map_link: "https://maps.app.goo.gl/iYGBPfd8wGH1RgMf7",
    restaurant_map_embed:
      "https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3619.155609450031!2d78.37295999999999!3d17.385372999999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMTfCsDIzJzA3LjMiTiA3OMKwMjInMjIuNyJF!5e1!3m2!1sen!2sin!4v1782893765574!5m2!1sen!2sin",
    packing_charge: "",
    gst_percent: "",
    open_time: "12:00",
    close_time: "23:00",
    delivery_time_slots: serializeDeliveryTimeSlots(DEFAULT_DELIVERY_TIME_SLOTS),
    delivery_time_slot_date_rules: "[]",
    coins_redemption_enabled: "true",
    coins_min_order_amount: "1000",
    hero_video_url: DEFAULT_HERO_VIDEO_URL,
    hero_audio_url: "",
    delivery_base_km: "3",
    delivery_base_fee: "100",
    delivery_extra_km_price: "15",
    delivery_max_km: "50",
    show_calories: "true",
    show_grams: "true"
  });
  const settingsDirtyRef = useRef(false);

  const handleCategoryDisplayToggle = async (category, field) => {
    if (
      field !== "show_calories" &&
      field !== "show_grams" &&
      field !== "show_ingredients" &&
      field !== "show_nutrients"
    ) {
      return;
    }
    const actionKey = `category-visibility-${category.id}-${field}`;
    if (isActionLoading(actionKey)) return;

    const currentOn = category[field] !== false;
    const nextValue = !currentOn;
    const optimistic = { [field]: nextValue };
    const rollback = { [field]: currentOn };

    setLocalCategories((prev) =>
      prev.map((entry) =>
        entry.id === category.id ? { ...entry, ...optimistic } : entry
      )
    );
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "category-visibility",
          id: category.id,
          [field]: nextValue,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!data?.success) {
        setLocalCategories((prev) =>
          prev.map((entry) =>
            entry.id === category.id ? { ...entry, ...rollback } : entry
          )
        );
        alert(data?.error || "Failed to update category display setting.");
      } else {
        const updated = data.data || data.category;
        if (updated) {
          setLocalCategories((prev) =>
            prev.map((entry) =>
              entry.id === category.id
                ? {
                    ...entry,
                    show_calories: updated.show_calories !== false,
                    show_grams: updated.show_grams !== false,
                    show_ingredients: updated.show_ingredients !== false,
                    show_nutrients: updated.show_nutrients !== false,
                  }
                : entry
            )
          );
        }
      }
    } catch (error) {
      setLocalCategories((prev) =>
        prev.map((entry) =>
          entry.id === category.id ? { ...entry, ...rollback } : entry
        )
      );
      alert(error.message || "Failed to update category display setting.");
    } finally {
      setActionLoading(null);
    }
  };

  const configuredTimeSlots = useMemo(
    () =>
      parseDeliveryTimeSlots(settingsState.delivery_time_slots, {
        openTime: settingsState.open_time,
        closeTime: settingsState.close_time
      }),
    [settingsState.delivery_time_slots, settingsState.open_time, settingsState.close_time]
  );

  const configuredDateSlotRules = useMemo(
    () => parseDeliveryTimeSlotDateRules(settingsState.delivery_time_slot_date_rules),
    [settingsState.delivery_time_slot_date_rules]
  );

  const [slotDateRuleDraft, setSlotDateRuleDraft] = useState(() => ({
    mode: "single",
    from: formatLocalDateYmd(),
    to: formatLocalDateYmd(),
    editingId: null,
    slots: []
  }));

  useEffect(() => {
    setSlotDateRuleDraft((prev) => {
      const previewDate = prev.from || formatLocalDateYmd();
      const withOverrides = applyDateSlotOverrides(
        configuredTimeSlots,
        settingsState.delivery_time_slot_date_rules,
        previewDate
      );
      return {
        ...prev,
        slots: withOverrides.map((slot) => ({
          startHour: slot.startHour,
          label: slot.label,
          enabled: slot.enabled !== false
        }))
      };
    });
    // Only re-seed draft slot list when base slots or saved rules change — not while typing dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuredTimeSlots, settingsState.delivery_time_slot_date_rules]);

  const refreshSlotDateDraftSlots = (fromDate, mode, toDate) => {
    const previewDate = fromDate || formatLocalDateYmd();
    const withOverrides = applyDateSlotOverrides(
      configuredTimeSlots,
      settingsState.delivery_time_slot_date_rules,
      previewDate
    );
    setSlotDateRuleDraft((prev) => ({
      ...prev,
      mode: mode ?? prev.mode,
      from: fromDate ?? prev.from,
      to: mode === "single" ? (fromDate ?? prev.from) : (toDate ?? prev.to),
      slots: withOverrides.map((slot) => ({
        startHour: slot.startHour,
        label: slot.label,
        enabled: slot.enabled !== false
      }))
    }));
  };

  const setDateRuleDraftSlotEnabled = (startHour, enabled) => {
    setSlotDateRuleDraft((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) =>
        slot.startHour === startHour ? { ...slot, enabled } : slot
      )
    }));
  };

  const saveDateSlotRule = async () => {
    const from = String(slotDateRuleDraft.from || "").trim();
    const to =
      slotDateRuleDraft.mode === "range"
        ? String(slotDateRuleDraft.to || "").trim()
        : from;

    if (!from || !to) {
      alert("Choose a date (or date range) for the time slot rule.");
      return;
    }
    if (to < from) {
      alert("End date must be on or after the start date.");
      return;
    }
    if (!slotDateRuleDraft.slots.length) {
      alert("No time slots available to save for these restaurant timings.");
      return;
    }

    const nextRule = {
      id: slotDateRuleDraft.editingId || `slot_rule_${Date.now().toString(36)}`,
      from,
      to,
      slots: slotDateRuleDraft.slots.map((slot) => ({
        startHour: slot.startHour,
        enabled: slot.enabled !== false
      }))
    };

    const withoutCurrent = configuredDateSlotRules.filter((rule) => {
      if (slotDateRuleDraft.editingId && rule.id === slotDateRuleDraft.editingId) return false;
      return !(rule.from === from && rule.to === to);
    });
    const nextRules = [...withoutCurrent, nextRule];
    const serialized = serializeDeliveryTimeSlotDateRules(nextRules);

    settingsDirtyRef.current = true;
    setSettingsState((prev) => ({ ...prev, delivery_time_slot_date_rules: serialized }));
    setSlotDateRuleDraft((prev) => ({ ...prev, editingId: nextRule.id }));

    const res = await executeAction(
      {
        action: "settings-update",
        settings: { delivery_time_slot_date_rules: serialized }
      },
      "date-slot-rules-save"
    );
    if (res?.success) {
      settingsDirtyRef.current = false;
      alert("Date-specific time slots saved.");
    }
  };

  const removeDateSlotRule = async (ruleId) => {
    const nextRules = configuredDateSlotRules.filter((rule) => rule.id !== ruleId);
    const serialized = serializeDeliveryTimeSlotDateRules(nextRules);

    settingsDirtyRef.current = true;
    setSettingsState((prev) => ({ ...prev, delivery_time_slot_date_rules: serialized }));
    setSlotDateRuleDraft((prev) =>
      prev.editingId === ruleId ? { ...prev, editingId: null } : prev
    );

    const res = await executeAction(
      {
        action: "settings-update",
        settings: { delivery_time_slot_date_rules: serialized }
      },
      `date-slot-rules-remove-${ruleId}`
    );
    if (res?.success) {
      settingsDirtyRef.current = false;
    }
  };

  const loadDateSlotRuleIntoDraft = (rule) => {
    const slotByHour = new Map(
      (rule.slots || []).map((slot) => [slot.startHour, slot.enabled !== false])
    );
    setSlotDateRuleDraft({
      mode: rule.from === rule.to ? "single" : "range",
      from: rule.from,
      to: rule.to,
      editingId: rule.id,
      slots: configuredTimeSlots.map((slot) => ({
        startHour: slot.startHour,
        label: slot.label,
        enabled: slotByHour.has(slot.startHour)
          ? slotByHour.get(slot.startHour)
          : slot.enabled !== false
      }))
    });
  };

  const handleRestaurantTimingChange = (field, value) => {
    settingsDirtyRef.current = true;
    setSettingsState((prev) => {
      const nextOpen = field === "open_time" ? value : prev.open_time;
      const nextClose = field === "close_time" ? value : prev.close_time;
      const regenerated = generateDeliveryTimeSlotsFromTimings(nextOpen, nextClose);
      const merged = mergeSlotEnabledState(
        regenerated,
        parseDeliveryTimeSlots(prev.delivery_time_slots, {
          openTime: prev.open_time,
          closeTime: prev.close_time
        })
      );

      return {
        ...prev,
        [field]: value,
        delivery_time_slots: serializeDeliveryTimeSlots(merged)
      };
    });
  };

  const updateSettingsField = (key, value) => {
    settingsDirtyRef.current = true;
    setSettingsState((prev) => ({ ...prev, [key]: value }));
  };

  const getStatusSelectStyle = (enabled) => ({
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
    minWidth: "120px",
    ...(enabled
      ? {
          background: "rgba(46, 125, 50, 0.28)",
          color: "#A5D6A7",
          border: "1px solid #43A047"
        }
      : {
          background: "rgba(198, 40, 40, 0.22)",
          color: "#EF9A9A",
          border: "1px solid #E53935"
        })
  });

  const setDeliveryTimeSlotEnabled = (index, enabled) => {
    const updated = configuredTimeSlots.map((slot, slotIndex) =>
      slotIndex === index ? { ...slot, enabled } : slot
    );
    updateSettingsField("delivery_time_slots", serializeDeliveryTimeSlots(updated));
  };

  const saveTimeSlotDefaults = async () => {
    const payload = {
      open_time: settingsState.open_time,
      close_time: settingsState.close_time,
      delivery_time_slots: settingsState.delivery_time_slots
    };
    const res = await executeAction(
      { action: "settings-update", settings: payload },
      "time-slots-defaults-save"
    );
    if (res?.success) {
      settingsDirtyRef.current = false;
      alert("Restaurant timings and default time slots saved.");
    }
  };

  const handleSyncLiveData = async () => {
    if (isSyncing || !onRefreshData) return;
    settingsDirtyRef.current = false;
    const range = sectionDateRanges[activeTab];
    await onRefreshData(
      activeTab,
      range
    );
  };

  const beginOtpCountdown = useCallback((seconds = 50) => {
    const ttl = Math.max(1, Number(seconds) || 50);
    setOtpExpiresAt(Date.now() + ttl * 1000);
    setOtpSecondsLeft(ttl);
  }, []);

  const clearOtpCountdown = useCallback(() => {
    setOtpExpiresAt(null);
    setOtpSecondsLeft(0);
  }, []);

  useEffect(() => {
    if (!otpExpiresAt) {
      setOtpSecondsLeft(0);
      return undefined;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setOtpSecondsLeft(left);
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [otpExpiresAt]);

  // Load Auth Status — tab session only (clears when tab is closed)
  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const hasTabSession =
          typeof window !== "undefined" && Boolean(sessionStorage.getItem(ADMIN_TAB_SESSION_KEY));

        if (!hasTabSession) {
          // Drop sticky httpOnly login for a fresh tab — do NOT wipe OTP pending cookie.
          await fetch("/api/admin-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ action: "clear-session" })
          });

          if (cancelled) return;

          const draft = readOtpDraft();
          if (draft) {
            setAdminEmail(draft.email);
            setOtpSent(true);
            setAuthMessage("A 6-digit code was sent. Check your inbox.");
            beginOtpCountdown(Math.max(1, Math.ceil((Number(draft.expiresAt) - Date.now()) / 1000)));
          }
          return;
        }

        const res = await fetch("/api/admin-auth", { credentials: "same-origin" });
        const data = await parseJsonResponse(res);
        if (cancelled) return;

        if (data.success && data.authenticated) {
          clearOtpDraft();
          setIsAuthenticated(true);
          if (onAuthChange) onAuthChange(true);
        } else {
          sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
          const draft = readOtpDraft();
          if (draft) {
            setAdminEmail(draft.email);
            setOtpSent(true);
            setAuthMessage("A 6-digit code was sent. Check your inbox.");
            beginOtpCountdown(Math.max(1, Math.ceil((Number(draft.expiresAt) - Date.now()) / 1000)));
          }
        }
      } catch (err) {
        console.error("Failed to verify admin session:", err);
        sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
      } finally {
        if (!cancelled) {
          requestAnimationFrame(() => {
            setSessionChecking(false);
          });
        }
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [onAuthChange, beginOtpCountdown]);

  // Open order detail from /admin?order=<id> (e.g. email "View Details")
  useEffect(() => {
    if (!isAuthenticated || deepLinkOrderHandledRef.current) return;
    if (typeof window === "undefined") return;
    const orderId = new URLSearchParams(window.location.search).get("order");
    if (!orderId) {
      deepLinkOrderHandledRef.current = true;
      return;
    }
    if (!Array.isArray(activeOrders) || activeOrders.length === 0) return;
    const match = activeOrders.find((o) => String(o.id) === String(orderId));
    if (!match) return;
    deepLinkOrderHandledRef.current = true;
    setActiveTab("orders");
    setSelectedOrder(match);
  }, [isAuthenticated, activeOrders]);

  // Sync settings from server only before the admin edits the form
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0 && !settingsDirtyRef.current) {
      setSettingsState((prev) => ({
        ...prev,
        restaurant_name: settings.restaurant_name ?? prev.restaurant_name,
        restaurant_phone: settings.restaurant_phone ?? prev.restaurant_phone,
        restaurant_email: settings.restaurant_email ?? prev.restaurant_email,
        restaurant_address: settings.restaurant_address ?? prev.restaurant_address,
        restaurant_map_link: settings.restaurant_map_link ?? prev.restaurant_map_link,
        restaurant_map_embed: settings.restaurant_map_embed ?? prev.restaurant_map_embed,
        packing_charge: settings.packing_charge ?? prev.packing_charge,
        gst_percent: settings.gst_percent ?? prev.gst_percent,
        open_time: settings.open_time ?? prev.open_time,
        close_time: settings.close_time ?? prev.close_time,
        delivery_time_slots: settings.delivery_time_slots ?? prev.delivery_time_slots,
        delivery_time_slot_date_rules:
          settings.delivery_time_slot_date_rules ?? prev.delivery_time_slot_date_rules,
        coins_redemption_enabled: settings.coins_redemption_enabled ?? prev.coins_redemption_enabled,
        coins_min_order_amount: settings.coins_min_order_amount ?? prev.coins_min_order_amount,
        hero_video_url: settings.hero_video_url ?? prev.hero_video_url,
        hero_audio_url: settings.hero_audio_url ?? prev.hero_audio_url,
        delivery_base_km: settings.delivery_base_km ?? prev.delivery_base_km,
        delivery_base_fee: settings.delivery_base_fee ?? prev.delivery_base_fee,
        delivery_extra_km_price: settings.delivery_extra_km_price ?? prev.delivery_extra_km_price,
        delivery_max_km: settings.delivery_max_km ?? prev.delivery_max_km,
        show_calories: settings.show_calories ?? prev.show_calories,
        show_grams: settings.show_grams ?? prev.show_grams
      }));
    }
  }, [settings]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setAuthError("");
    setAuthMessage("");

    const trimmed = adminEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    setAuthLoading(true);

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "send-otp", email: trimmed })
      });
      const data = await parseJsonResponse(res);

      if (data.success) {
        setOtpSent(true);
        setAuthMessage(data.message || "A 6-digit code has been sent. Check your inbox.");
        setOtp("");
        const ttl = data.expiresIn || 50;
        const expiresAt = Date.now() + ttl * 1000;
        writeOtpDraft(trimmed, expiresAt);
        beginOtpCountdown(ttl);
      } else {
        setAuthError(data.error || "Failed to send OTP.");
      }
    } catch (err) {
      setAuthError(err.message || "Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendOtp = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setAuthError("");
    setAuthMessage("");

    const trimmed = adminEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    setResendLoading(true);

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "resend-otp", email: trimmed })
      });
      const data = await parseJsonResponse(res);

      if (data.success) {
        setOtpSent(true);
        setAuthMessage(data.message || "A new 6-digit code has been sent. Use the latest email.");
        setOtp("");
        setAuthError("");
        const ttl = data.expiresIn || 50;
        const expiresAt = Date.now() + ttl * 1000;
        writeOtpDraft(trimmed, expiresAt);
        beginOtpCountdown(ttl);
      } else {
        setAuthError(data.error || "Failed to resend OTP.");
      }
    } catch (err) {
      setAuthError(err.message || "Network error. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    const cleanOtp = sanitizeOtpInput(otp);
    if (cleanOtp.length !== 6) {
      setAuthError("Enter the full 6-digit OTP from your email.");
      setOtp(cleanOtp);
      return;
    }
    if (otpSecondsLeft <= 0) {
      setAuthError("OTP expired. Please resend a new code.");
      return;
    }
    setAuthLoading(true);

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "verify-otp",
          email: adminEmail.trim(),
          otp: cleanOtp
        })
      });
      const data = await parseJsonResponse(res);

      if (data.success) {
        sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, "1");
        clearOtpDraft();
        setIsAuthenticated(true);
        setAuthError("");
        clearOtpCountdown();
        if (onAuthChange) onAuthChange(true);
      } else {
        setAuthError(data.error || "Invalid OTP.");
      }
    } catch (err) {
      setAuthError(err.message || "Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
    clearOtpDraft();
    setIsAuthenticated(false);
    setOtpSent(false);
    setOtp("");
    clearOtpCountdown();
    setAdminEmail("");
    setAuthError("");
    setAuthMessage("");
    if (onAuthChange) onAuthChange(false);
  };

  // Generic DB mutation post handler
  const executeAction = async (payload, loadingKey) => {
    const key = loadingKey || payload?.action || "admin-action";
    setActionLoading(key);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        const actionName = String(payload?.action || "");
        if (
          actionName.startsWith("product-") ||
          actionName.startsWith("category-") ||
          actionName.startsWith("addon-") ||
          actionName.startsWith("coupon-") ||
          actionName.startsWith("settings-") ||
          actionName.startsWith("upcoming-") ||
          actionName.startsWith("update-") ||
          actionName.startsWith("event-")
        ) {
          clearMenuPayloadCache();
        }
        if (onRefreshData) onRefreshData(activeTab);
        return { success: true, data: data.data };
      } else {
        alert("Operation Error: " + data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error(err);
      alert("Network communication error.");
      return { success: false, error: err.message };
    } finally {
      setActionLoading(null);
    }
  };

  const isActionLoading = (key) => actionLoading === key;

  const DELIVERED_STATUS = "Delivered & Plated";
  const DELIVERED_CLASS = "delivered";
  const PENDING_STATUS = "Pending";
  const PENDING_CLASS = "accepted";
  const CANCELLED_STATUS = "Cancelled";
  const CANCELLED_CLASS = "cancelled";

  const isOrderCancelled = (status) => (status || "").toLowerCase() === "cancelled";

  const isOrderDelivered = (status) => {
    const s = (status || "").toLowerCase();
    return s === "delivered & plated" || s === "delivered";
  };

  const isOrderCompleted = (status) => {
    const s = (status || "").toLowerCase();
    return s === "delivered & plated" || s === "delivered" || s === "cancelled";
  };

  const dashOrdersSource = dashboardOrders.length > 0 ? dashboardOrders : activeOrders;
  const pendingOrdersList = dashOrdersSource.filter((o) => isPendingOrderStatus(o.status));

  const markOrderDelivered = async (orderId) => {
    await triggerStatusUpdate(orderId, DELIVERED_STATUS, DELIVERED_CLASS);
  };

  const markOrderPending = (orderId) => {
    setAppConfirm({
      message: "Revert this order back to Pending?",
      onConfirm: async () => {
        await triggerStatusUpdate(orderId, PENDING_STATUS, PENDING_CLASS);
      }
    });
  };

  const markOrderCancelled = (order) => {
    const label = order.displayOrderId || formatOrderNumber(order.orderNumber) || order.id;
    setAppConfirm({
      message: `Cancel order ${label}? This will move it to Cancelled and exclude it from revenue totals.`,
      onConfirm: async () => {
        await triggerStatusUpdate(order.id, CANCELLED_STATUS, CANCELLED_CLASS);
      }
    });
  };

  const undoCancelledOrder = (order) => {
    const orderRef = typeof order === "string" ? order : order.id;
    const label =
      typeof order === "string"
        ? orderRef
        : order.displayOrderId || formatOrderNumber(order.orderNumber) || order.id;
    setAppConfirm({
      message: `Restore order ${label} to Pending?`,
      onConfirm: async () => {
        await triggerStatusUpdate(orderRef, PENDING_STATUS, PENDING_CLASS);
      }
    });
  };

  const triggerStatusUpdate = async (orderId, nextStatus, nextClass) => {
    const res = await executeAction({
      action: "update-order-status",
      orderId,
      status: nextStatus,
      statusClass: nextClass
    }, `order-status-${orderId}`);
    if (res.success) {
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: nextStatus, statusClass: nextClass }));
      }
      if (onRefreshData && activeTab !== "dashboard") {
        onRefreshData("dashboard");
      }
    }
  };

  const toggleOrderCompletion = async (orderId, currentStatus) => {
    if (isOrderDelivered(currentStatus)) {
      await triggerStatusUpdate(orderId, PENDING_STATUS, PENDING_CLASS);
      return;
    }
    if (!isOrderCompleted(currentStatus)) {
      await triggerStatusUpdate(orderId, DELIVERED_STATUS, DELIVERED_CLASS);
    }
  };

  const renderOrderStatusControl = (order) => {
    const loadingKey = `order-status-${order.id}`;
    const loading = isActionLoading(loadingKey);
    const statusLabel =
      order.status || (isOrderDelivered(order.status) ? DELIVERED_STATUS : PENDING_STATUS);

    if (isOrderCancelled(order.status)) {
      return (
        <button
          type="button"
          className="order-status-toggle is-undo-pending admin-surface-light"
          disabled={loading}
          aria-busy={loading || undefined}
          title="Restore this order to Pending"
          onClick={() => undoCancelledOrder(order)}
        >
          {loading ? "Updating…" : "Undo to Pending"}
        </button>
      );
    }

    return (
      <button
        type="button"
        className={`order-status-toggle ${isOrderDelivered(order.status) ? "is-completed" : "is-pending"}`}
        disabled={loading}
        aria-busy={loading || undefined}
        title={
          isOrderDelivered(order.status)
            ? "Click to revert to Pending"
            : "Click to mark as completed"
        }
        style={
          isOrderDelivered(order.status)
            ? {
                background: "#FFFFFF",
                color: "#000000",
                border: "1px solid rgba(0, 0, 0, 0.15)"
              }
            : {
                background: "#D4AF37",
                color: "#011E02",
                border: "1px solid #F0D875"
              }
        }
        onClick={() => toggleOrderCompletion(order.id, order.status)}
      >
        {loading ? "Updating…" : statusLabel}
      </button>
    );
  };

  // Product CRUD
  const handleProductSubmit = async (e) => {
    e.preventDefault();

    if (productImageUploading) {
      alert("Please wait for the image upload to finish.");
      return;
    }

    const parseOptionalDecimal = (raw, { integer = false } = {}) => {
      const cleaned = sanitizeDecimalInput(raw);
      if (!cleaned || cleaned === ".") return null;
      const num = Number(cleaned);
      if (Number.isNaN(num)) return null;
      return integer ? Math.round(num) : num;
    };

    const selectedCategoryName =
      categories.find((c) => String(c.id) === String(productForm.category_id))?.name || "";
    const isCookieItem =
      isCookiesCategory(selectedCategoryName) || isCookiesCategory(productForm.name || "");
    const isBreadItem =
      isBreadsCategory(selectedCategoryName) || isBreadsCategory(productForm.name || "");
    const isSinglePriceItem = isCookieItem || isBreadItem;

    // Cookies / breads use a simple unit price; other items use Small/Medium/Large slots.
    const sizePricesRaw = isSinglePriceItem
      ? isCookieItem
        ? String(productForm.sizePricesRaw || "").trim()
        : normalizeSizePricesInput(
            String(productForm.sizePricesRaw || productForm.price || "")
              .split(",")[0]
              ?.trim() || ""
          )
      : normalizeSizePricesInput(productForm.sizePricesRaw || "");
    const priceNum = isCookieItem
      ? (() => {
          const match = String(sizePricesRaw || "").match(/[\d.]+/);
          return match ? parseFloat(match[0]) : 0;
        })()
      : firstSizePrice(sizePricesRaw);

    const sizeCaloriesRaw = isSinglePriceItem
      ? normalizeSizeCaloriesInput(
          String(productForm.sizeCaloriesRaw || productForm.calories || "")
            .split(",")[0]
            ?.trim() || ""
        )
      : normalizeSizeCaloriesInput(productForm.sizeCaloriesRaw || productForm.calories || "");

    const action = productForm.mode === "create" ? "product-create" : "product-update";
    const payload = {
      action,
      product: {
        category_id: parseInt(productForm.category_id, 10),
        name: productForm.name || "",
        price: priceNum,
        sizePricesRaw,
        sizeGramsRaw: isSinglePriceItem
          ? ""
          : normalizeSizeGramsInput(productForm.sizeGramsRaw || ""),
        sizeCaloriesRaw,
        calories: firstSizeCalorie(
          sizeCaloriesRaw,
          parseOptionalDecimal(String(sizeCaloriesRaw || "").split(",")[0], { integer: true })
        ),
        rating: parseOptionalDecimal(productForm.rating),
        description: productForm.description || "",
        image: productForm.image || "",
        in_stock: productForm.in_stock,
        quantity: productForm.in_stock ? 100 : 0,
        subCategory: productForm.subCategory || "regular",
        protein: parseOptionalDecimal(productForm.protein),
        carbohydrates: parseOptionalDecimal(productForm.carbohydrates),
        fats: parseOptionalDecimal(productForm.fats),
        ingredients: productForm.ingredients || "",
        show_in_menu: productForm.show_in_menu !== false,
      }
    };
    if (isCookieItem) {
      Object.assign(payload.product, {
        serving_size: parseOptionalDecimal(productForm.serving_size),
        serving_weight_g: parseOptionalDecimal(productForm.serving_weight_g),
        total_weight_g: parseOptionalDecimal(productForm.total_weight_g),
        saturated_fat: parseOptionalDecimal(productForm.saturated_fat),
        sugar: parseOptionalDecimal(productForm.sugar),
        dietary_fibre: parseOptionalDecimal(productForm.dietary_fibre),
        sodium_mg: parseOptionalDecimal(productForm.sodium_mg),
      });
    }
    if (productForm.mode === "edit") {
      payload.id = productForm.id;
    }
    const res = await executeAction(payload, "product-submit");
    if (res.success) {
      try {
        sessionStorage.removeItem("theoh_menu_payload_v19");
        sessionStorage.removeItem("theoh_menu_payload_v18");
        sessionStorage.removeItem("theoh_menu_payload_v17");
      } catch (_) {}
      dismissAdminOverlay();
    }
  };

  const handleProductDelete = async (id) => {
    setAppConfirm({
      message: "Are you sure you want to delete this product?",
      onConfirm: async () => {
        await executeAction({ action: "product-delete", id }, `product-delete-${id}`);
      }
    });
  };

  // Optimistic stock toggle — update UI instantly, sync API in background
  const handleStockToggle = async (prod) => {
    const stockKey = `stock-${prod.id}`;
    if (isActionLoading(stockKey)) return;
    const newStockState = !prod.in_stock;
    const prevQty = parseInt(prod.quantity, 10);
    const nextQuantity = newStockState
      ? Number.isFinite(prevQty) && prevQty > 0
        ? prevQty
        : 100
      : 0;
    // 1. Flip immediately in local state (zero-latency)
    setLocalProducts((prev) =>
      prev.map((p) =>
        p.id === prod.id ? { ...p, in_stock: newStockState, quantity: nextQuantity } : p
      )
    );
    // 2. Persist stock only — never wipe nutrition / prices / description.
    setActionLoading(stockKey);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "product-stock",
          id: prod.id,
          in_stock: newStockState,
          quantity: nextQuantity,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!data.success) {
        setLocalProducts((prev) =>
          prev.map((p) =>
            p.id === prod.id ? { ...p, in_stock: prod.in_stock, quantity: prod.quantity } : p
          )
        );
        alert("Stock update failed: " + data.error);
      } else {
        clearMenuPayloadCache();
      }
    } catch (err) {
      console.error("Stock toggle error:", err);
      setLocalProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id ? { ...p, in_stock: prod.in_stock, quantity: prod.quantity } : p
        )
      );
      alert("Stock update failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleProductVisibilityToggle = async (prod) => {
    const actionKey = `product-visibility-${prod.id}`;
    if (isActionLoading(actionKey)) return;
    const current = prod.show_in_menu !== false;
    const nextValue = !current;
    setLocalProducts((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...p, show_in_menu: nextValue } : p))
    );
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "product-visibility",
          id: prod.id,
          show_in_menu: nextValue,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!data?.success) {
        setLocalProducts((prev) =>
          prev.map((p) => (p.id === prod.id ? { ...p, show_in_menu: current } : p))
        );
        alert(data?.error || "Failed to update item menu visibility.");
      } else {
        clearMenuPayloadCache();
        const updated = data.data || data.product;
        if (updated) {
          setLocalProducts((prev) =>
            prev.map((p) =>
              p.id === prod.id
                ? { ...p, show_in_menu: updated.show_in_menu !== false }
                : p
            )
          );
        }
      }
    } catch (error) {
      setLocalProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, show_in_menu: current } : p))
      );
      alert(error.message || "Failed to update item menu visibility.");
    } finally {
      setActionLoading(null);
    }
  };

  // Category CRUD
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const action = categoryForm.mode === "create" ? "category-create" : "category-update";
    const payload = {
      action,
      category: { name: categoryForm.name }
    };
    if (categoryForm.mode === "edit") {
      payload.id = categoryForm.id;
    }
    const res = await executeAction(payload, "category-submit");
    if (res.success) {
      setCategoryForm(null);
    }
  };

  const handleCategoryDelete = async (id) => {
    setAppConfirm({
      message: "Are you sure you want to delete this category? All its products will be orphaned.",
      onConfirm: async () => {
        await executeAction({ action: "category-delete", id }, `category-delete-${id}`);
      }
    });
  };

  const handleCategoryVisibilityToggle = async (category, field) => {
    const actionKey = `category-visibility-${category.id}-${field}`;
    if (isActionLoading(actionKey)) return;

    const menuOn = category.show_in_menu !== false;
    const titleOn = Boolean(category.show_section) && menuOn;

    // Title can only be ON while Menu is ON
    if (field === "show_section" && !menuOn) return;

    const nextValue = field === "show_in_menu" ? !menuOn : !titleOn;
    const optimistic = {
      show_in_menu: field === "show_in_menu" ? nextValue : menuOn,
      show_section:
        field === "show_in_menu"
          ? nextValue
            ? Boolean(category.show_section)
            : false
          : nextValue,
    };
    // Menu OFF always forces Title OFF in the UI
    if (!optimistic.show_in_menu) optimistic.show_section = false;

    const rollback = {
      show_in_menu: menuOn,
      show_section: Boolean(category.show_section),
    };

    setLocalCategories((prev) =>
      prev.map((entry) =>
        entry.id === category.id ? { ...entry, ...optimistic } : entry
      )
    );
    setActionLoading(actionKey);
    try {
      const body = {
        action: "category-visibility",
        id: category.id,
        ...optimistic,
      };
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJsonResponse(res);
      if (!data?.success) {
        setLocalCategories((prev) =>
          prev.map((entry) =>
            entry.id === category.id ? { ...entry, ...rollback } : entry
          )
        );
        alert(data?.error || "Failed to update category visibility.");
      } else {
        clearMenuPayloadCache();
        const updated = data.data || data.category;
        if (updated) {
          const nextMenu = updated.show_in_menu !== false;
          setLocalCategories((prev) =>
            prev.map((entry) =>
              entry.id === category.id
                ? {
                    ...entry,
                    show_in_menu: nextMenu,
                    show_section: nextMenu && Boolean(updated.show_section),
                    show_calories:
                      updated.show_calories !== undefined
                        ? updated.show_calories !== false
                        : entry.show_calories !== false,
                    show_grams:
                      updated.show_grams !== undefined
                        ? updated.show_grams !== false
                        : entry.show_grams !== false,
                    show_ingredients:
                      updated.show_ingredients !== undefined
                        ? updated.show_ingredients !== false
                        : entry.show_ingredients !== false,
                    show_nutrients:
                      updated.show_nutrients !== undefined
                        ? updated.show_nutrients !== false
                        : entry.show_nutrients !== false,
                  }
                : entry
            )
          );
        }
      }
    } catch (error) {
      setLocalCategories((prev) =>
        prev.map((entry) =>
          entry.id === category.id ? { ...entry, ...rollback } : entry
        )
      );
      alert(error.message || "Failed to update category visibility.");
    } finally {
      setActionLoading(null);
    }
  };

  // Addon CRUD
  const handleAddonVisibilityToggle = async (addon) => {
    const actionKey = `addon-visibility-${addon.id}`;
    if (isActionLoading(actionKey)) return;
    const current = addon.is_active !== false;
    const nextValue = !current;
    setLocalAddons((prev) =>
      prev.map((entry) =>
        entry.id === addon.id ? { ...entry, is_active: nextValue } : entry
      )
    );
    setActionLoading(actionKey);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addon-visibility",
          id: addon.id,
          is_active: nextValue,
        }),
      });
      const data = await parseJsonResponse(res);
      if (!data?.success) {
        setLocalAddons((prev) =>
          prev.map((entry) =>
            entry.id === addon.id ? { ...entry, is_active: current } : entry
          )
        );
        alert(data?.error || "Failed to update addon visibility.");
      } else {
        clearMenuPayloadCache();
        const updated = data.data || data.addon;
        if (updated) {
          setLocalAddons((prev) =>
            prev.map((entry) =>
              entry.id === addon.id
                ? { ...entry, is_active: updated.is_active !== false }
                : entry
            )
          );
        }
      }
    } catch (error) {
      setLocalAddons((prev) =>
        prev.map((entry) =>
          entry.id === addon.id ? { ...entry, is_active: current } : entry
        )
      );
      alert(error.message || "Failed to update addon visibility.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddonSubmit = async (e) => {
    e.preventDefault();
    const action = addonForm.mode === "create" ? "addon-create" : "addon-update";
    const payload = {
      action,
      addon: {
        name: addonForm.name,
        price: parseFloat(addonForm.price),
        grams: addonForm.grams === "" || addonForm.grams == null
          ? 30
          : parseInt(addonForm.grams, 10),
        calories: addonForm.calories === "" || addonForm.calories == null
          ? lookupAddonCalories(addonForm.name)
          : parseFloat(addonForm.calories)
      }
    };
    if (addonForm.mode === "create") {
      payload.addon.category_id = parseInt(addonForm.category_id, 10);
    } else {
      if (addonForm.ids && addonForm.ids.length > 0) {
        payload.ids = addonForm.ids;
      } else {
        payload.id = addonForm.id;
      }
      payload.addon.category_id = parseInt(addonForm.category_id, 10);
    }
    const res = await executeAction(payload, "addon-submit");
    if (res.success) {
      setAddonForm(null);
    }
  };

  const handleAddonDelete = async (idOrIds) => {
    setAppConfirm({
      message: "Are you sure you want to delete this addon?",
      onConfirm: async () => {
        if (Array.isArray(idOrIds)) {
          await executeAction({ action: "addon-delete", ids: idOrIds }, `addon-delete-${idOrIds.join("-")}`);
        } else {
          await executeAction({ action: "addon-delete", id: idOrIds }, `addon-delete-${idOrIds}`);
        }
      }
    });
  };

  // Coupon CRUD
  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    const action = couponForm.mode === "create" ? "coupon-create" : "coupon-update";
    const normalizedCode = couponForm.code.trim().toUpperCase();
    const payload = {
      action,
      code: couponForm.mode === "edit" ? (couponForm.originalCode || normalizedCode) : normalizedCode,
      coupon: {
        code: normalizedCode,
        discount_percent: parseFloat(couponForm.discount_percent),
        is_active: couponForm.is_active,
        phone_restriction: couponForm.phone_restriction || null,
        min_order_amount: parseFloat(couponForm.min_order_amount || 0)
      }
    };
    const res = await executeAction(payload, "coupon-submit");
    if (res.success) {
      setCouponForm(null);
    }
  };

  const handleCouponDelete = async (code) => {
    setAppConfirm({
      message: `Are you sure you want to delete coupon ${code}?`,
      onConfirm: async () => {
        await executeAction({ action: "coupon-delete", code }, `coupon-delete-${code}`);
      }
    });
  };

  // Coin Adjustment
  const handleCoinAdjustSubmit = async (e) => {
    e.preventDefault();
    const res = await executeAction({
      action: "coin-adjust",
      phone: coinAdjustForm.phone,
      actionType: coinAdjustForm.actionType,
      amount: parseInt(coinAdjustForm.amount, 10)
    }, "coin-adjust");
    if (res.success) {
      setCoinAdjustForm(null);
    }
  };

  // Global Settings save
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    const res = await executeAction({
      action: "settings-update",
      settings: settingsState
    }, "settings-submit");
    if (res.success) {
      settingsDirtyRef.current = false;
      alert("System Settings saved successfully!");
    }
  };

  // Business Updates CRUD
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const action = updateForm.mode === "create" ? "update-create" : "update-update";
    const payload = {
      action,
      id: updateForm.id || null,
      update: {
        title: updateForm.title,
        subtitle: updateForm.subtitle || "",
        content: updateForm.content,
        tag: updateForm.tag || "New Store",
        image_url: updateForm.image_url || "/masala_oats.png"
      }
    };
    const res = await executeAction(payload, "update-submit");
    if (res.success) {
      setUpdateForm(null);
    }
  };

  const handleUpdateDelete = async (id) => {
    setAppConfirm({
      message: "Are you sure you want to delete this business update?",
      onConfirm: async () => {
        await executeAction({ action: "update-delete", id }, `update-delete-${id}`);
      }
    });
  };

  // Pop-up Events CRUD
  const handleEventSubmit = async (e) => {
    e.preventDefault();
    const action = eventForm.mode === "create" ? "event-create" : "event-update";
    const payload = {
      action,
      id: eventForm.id || null,
      event: {
        title: eventForm.title,
        location: eventForm.location,
        event_date: eventForm.event_date,
        description: eventForm.description,
        requires_registration: !!eventForm.requires_registration,
        image_url: eventForm.image_url || "/south_indian_upma.png"
      }
    };
    const res = await executeAction(payload, "event-submit");
    if (res.success) {
      setEventForm(null);
    }
  };

  const handleEventDelete = async (id) => {
    setAppConfirm({
      message: "Are you sure you want to delete this event?",
      onConfirm: async () => {
        await executeAction({ action: "event-delete", id }, `event-delete-${id}`);
      }
    });
  };

  const handleContactDelete = (id) => {
    setAppConfirm({
      message: "Remove this guest inquiry? This cannot be undone.",
      onConfirm: async () => {
        await executeAction({ action: "contact-delete", id }, `contact-delete-${id}`);
      }
    });
  };

  const handleUpcomingItemSubmit = async (e) => {
    e.preventDefault();

    if (upcomingImageUploading) {
      alert("Please wait for the image upload to finish.");
      return;
    }

    if (!upcomingItemForm.image) {
      alert("Please upload an item image before saving.");
      return;
    }

    const action = upcomingItemForm.mode === "create" ? "upcoming-create" : "upcoming-update";
    const payload = {
      action,
      id: upcomingItemForm.id,
      upcomingItem: {
        name: upcomingItemForm.name,
        description: upcomingItemForm.description,
        image: upcomingItemForm.image
      }
    };
    const res = await executeAction(payload, "upcoming-submit");
    if (res.success) {
      setUpcomingImageUploading(false);
      setUpcomingItemForm(null);
    }
  };

  const handleUpcomingItemDelete = async (id) => {
    setAppConfirm({
      message: "Are you sure you want to delete this upcoming item?",
      onConfirm: async () => {
        await executeAction({ action: "upcoming-delete", id }, `upcoming-delete-${id}`);
      }
    });
  };

  const handleViewRegistrations = async (eventId, eventTitle) => {
    const res = await executeAction({ action: "event-registrations-get", eventId }, `event-regs-${eventId}`);
    if (res.success && res.data) {
      setSelectedEventRegs({
        eventTitle,
        list: res.data
      });
    }
  };

  // Authentication Login Screen
  if (sessionChecking) {
    return <AdminBootLoader message="Verifying session…" />;
  }

  if (isAuthenticated && !adminBootReady) {
    return <AdminBootLoader compact message="Loading…" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login-overlay">
        <div className="login-split-card">
          <div className="login-brand-panel">
            <div className="login-logo-ring">
              <Image
                src={BRAND_LOGO}
                alt="THE OH ! logo"
                width={260}
                height={260}
                className="login-logo-img"
                priority
              />
            </div>
            <p className="login-brand-tagline">Oats &amp; Habits</p>
          </div>

          <div className="login-form-panel">
            <div className="login-form-inner">
              <div className="login-header-icon">
                <Lock className="icon-gold" size={28} />
              </div>
              <h3>Owner&apos;s Vault</h3>
              <p>Sign in with your authorized email. We&apos;ll send a one-time code to your inbox.</p>

              <form
                className="admin-auth-form"
                onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
                autoComplete="off"
                noValidate
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  gridTemplateRows: "auto auto",
                  gridAutoFlow: "row",
                  width: "100%",
                }}
              >
                <div className="admin-auth-fields" style={{ gridRow: 1 }}>
                  <div className="input-group auth-input-group admin-auth-email-group">
                    <label htmlFor="theoh-vault-email">Admin Email</label>
                    <input
                      id="theoh-vault-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      placeholder="Enter admin email..."
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      disabled={authLoading || otpSent}
                      autoComplete="username"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                    />
                  </div>

                  {otpSent && (
                    <>
                      <div className="input-group auth-input-group admin-auth-otp-group">
                        <label htmlFor="theoh-vault-otp">6-Digit OTP</label>
                        <input
                          id="theoh-vault-otp"
                          name="otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          enterKeyHint="done"
                          placeholder="Enter code from email..."
                          value={otp}
                          onChange={(e) => setOtp(sanitizeOtpInput(e.target.value))}
                          onPaste={(e) => {
                            e.preventDefault();
                            setOtp(otpFromClipboardEvent(e));
                          }}
                          onInput={(e) => {
                            const next = sanitizeOtpInput(e.currentTarget.value);
                            if (next !== otp) setOtp(next);
                          }}
                          required
                          disabled={authLoading || resendLoading}
                          autoFocus
                          data-lpignore="true"
                          data-1p-ignore="true"
                        />
                      </div>
                      <div className="admin-otp-resend-row">
                        <span className="admin-otp-resend-hint">Didn&apos;t receive the code?</span>
                        <LoadingButton
                          type="button"
                          className="admin-vault-resend-btn"
                          loading={resendLoading}
                          loadingText="Sending…"
                          disabled={authLoading}
                          onClick={handleResendOtp}
                        >
                          Resend OTP
                        </LoadingButton>
                      </div>
                      <p
                        className={`admin-otp-timer${otpSecondsLeft <= 0 ? " is-expired" : ""}`}
                        aria-live="polite"
                      >
                        {otpSecondsLeft > 0 ? (
                          <>
                            OTP expires in <span className="admin-otp-timer-count">{otpSecondsLeft}s</span>
                          </>
                        ) : (
                          <>OTP expired. Resend a new code.</>
                        )}
                      </p>
                    </>
                  )}

                  {authError && <p className="auth-error-msg">{authError}</p>}
                  {authMessage && <p className="auth-success-msg">{authMessage}</p>}
                </div>

                <div className="auth-submit-wrap" style={{ gridRow: 2, marginTop: 28 }}>
                  {!otpSent ? (
                    <LoadingButton
                      type="submit"
                      className="btn-primary auth-submit-btn"
                      loading={authLoading}
                      loadingText="Sending…"
                    >
                      Authenticate <Sparkles size={16} />
                    </LoadingButton>
                  ) : (
                    <LoadingButton
                      type="submit"
                      className="btn-primary auth-submit-btn"
                      loading={authLoading}
                      loadingText="Verifying…"
                      disabled={
                        sanitizeOtpInput(otp).length !== 6 ||
                        resendLoading ||
                        otpSecondsLeft <= 0
                      }
                    >
                      Verify OTP
                    </LoadingButton>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        <style jsx>{`
          .admin-login-overlay {
            position: fixed;
            inset: 0;
            background: radial-gradient(circle at 20% 20%, rgba(1, 46, 2, 0.25), transparent 45%),
              radial-gradient(circle at 80% 80%, rgba(1, 46, 2, 0.15), transparent 40%),
              #0A0B09;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            justify-content: safe center;
            padding: 24px;
            z-index: 9999;
            overflow-x: hidden;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            box-sizing: border-box;
          }

          .login-split-card {
            width: 100%;
            max-width: 920px;
            min-height: 520px;
            margin: auto;
            flex-shrink: 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-areas: "brand form";
            border-radius: 20px;
            overflow: hidden;
            border: 1px solid rgba(1, 46, 2, 0.35);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
            background: rgba(12, 14, 11, 0.95);
          }

          .login-brand-panel {
            grid-area: brand;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px 32px;
            background: linear-gradient(160deg, rgba(1, 46, 2, 0.35) 0%, rgba(10, 11, 9, 0.2) 100%);
            border-right: 1px solid rgba(1, 46, 2, 0.25);
          }

          .login-logo-ring {
            width: 260px;
            height: 260px;
            border-radius: 50%;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
          }

          .login-logo-ring :global(.login-logo-img) {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }

          .login-brand-tagline {
            margin-top: 28px;
            color: rgba(255, 255, 255, 0.55);
            font-size: 13px;
            letter-spacing: 2px;
            text-transform: uppercase;
          }

          .login-form-panel {
            grid-area: form;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 48px 40px;
          }

          .login-form-inner {
            width: 100%;
            max-width: 340px;
          }

          .login-header-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px;
            background: rgba(1, 46, 2, 0.18);
            border-radius: 50%;
            margin-bottom: 18px;
          }

          .login-form-inner h3 {
            font-family: var(--font-poppins)"Playfair Display", serif;
            color: #fff;
            font-size: 28px;
            margin: 0 0 10px 0;
            line-height: 1.2;
          }

          .login-form-inner p {
            color: rgba(255, 255, 255, 0.58);
            font-size: 13px;
            margin: 0 0 28px 0;
            line-height: 1.6;
          }

          /* Safari reorders submit above inputs when <form> is display:flex — use grid rows. */
          .admin-auth-form {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto auto;
            grid-auto-flow: row;
            width: 100%;
            align-content: start;
          }

          .admin-auth-fields {
            display: block;
            width: 100%;
            grid-row: 1;
          }

          .auth-input-group {
            display: block;
            width: 100%;
            margin: 0 0 20px 0;
          }

          .auth-input-group :global(label) {
            display: block;
            margin-bottom: 8px;
            text-align: left;
            color: rgba(255, 255, 255, 0.75);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.4px;
          }

          .auth-input-group :global(input) {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            height: 48px;
            padding: 0 16px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.04);
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            text-align: left;
            line-height: normal;
            -webkit-appearance: none;
            appearance: none;
          }

          .auth-input-group :global(input::placeholder) {
            text-align: left;
            color: rgba(255, 255, 255, 0.45);
          }

          .auth-input-group :global(input:focus) {
            border-color: rgba(1, 46, 2, 0.8);
            box-shadow: 0 0 0 3px rgba(1, 46, 2, 0.2);
          }

          .auth-input-group :global(input:disabled) {
            opacity: 0.65;
          }

          .auth-submit-wrap {
            display: block;
            width: 100%;
            margin-top: 28px;
            grid-row: 2;
          }

          .auth-submit-wrap :global(.auth-submit-btn),
          .auth-submit-wrap :global(button) {
            width: 100%;
            justify-content: center;
            padding: 14px 20px;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.3px;
            text-transform: none;
            cursor: pointer;
            border: none;
            -webkit-appearance: none;
            appearance: none;
            float: none;
            position: relative;
          }

          .admin-otp-resend-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin: -4px 0 16px;
            flex-wrap: wrap;
          }

          .admin-otp-resend-hint {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.55);
            line-height: 1.4;
          }

          .admin-otp-timer {
            margin: 0 0 12px 0;
            font-size: 13px;
            line-height: 1.4;
            color: rgba(255, 255, 255, 0.7);
            text-align: left;
          }

          .admin-otp-timer-count {
            color: #ffffff;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.02em;
          }

          .admin-otp-timer.is-expired {
            color: #ef9a9a;
          }

          .auth-error-msg {
            color: #ef9a9a;
            font-size: 12px;
            margin: -4px 0 12px 0;
            text-align: left;
            line-height: 1.4;
          }

          .auth-success-msg {
            color: #a5d6a7;
            font-size: 12px;
            margin: -4px 0 12px 0;
            text-align: left;
            line-height: 1.4;
          }

          @media (max-width: 768px) {
            .admin-login-overlay {
              align-items: center;
              justify-content: center;
              justify-content: safe center;
              padding: 12px;
              padding-top: max(12px, env(safe-area-inset-top, 0px));
              padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
            }

            .login-split-card {
              grid-template-columns: 1fr;
              grid-template-areas:
                "brand"
                "form";
              width: 100%;
              max-width: 400px;
              min-height: 0;
              max-height: none;
              margin: auto;
              border-radius: 16px;
              overflow: visible;
            }

            .login-brand-panel {
              padding: 16px 16px 10px;
              border-right: none;
              border-bottom: 1px solid rgba(1, 46, 2, 0.25);
            }

            .login-logo-ring {
              width: 96px;
              height: 96px;
              box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
            }

            .login-brand-tagline {
              margin-top: 8px;
              font-size: 10px;
              letter-spacing: 1.4px;
            }

            .login-form-panel {
              padding: 14px 16px 18px;
              align-items: stretch;
            }

            .login-form-inner {
              max-width: 100%;
            }

            .login-header-icon {
              padding: 8px;
              margin-bottom: 8px;
            }

            .login-header-icon :global(svg) {
              width: 20px;
              height: 20px;
            }

            .login-form-inner h3 {
              font-size: 22px;
              margin: 0 0 6px 0;
            }

            .login-form-inner p {
              font-size: 12px;
              margin: 0 0 14px 0;
              line-height: 1.45;
            }

            .auth-input-group {
              margin: 0 0 12px 0;
            }

            .auth-input-group :global(label) {
              margin-bottom: 5px;
              font-size: 11px;
            }

            .auth-input-group :global(input) {
              height: 42px;
              padding: 0 12px;
              font-size: 14px;
            }

            .admin-otp-resend-row {
              margin: 0 0 10px;
              gap: 8px;
            }

            .auth-error-msg,
            .auth-success-msg {
              margin: 0 0 10px 0;
            }

            .auth-submit-wrap {
              margin-top: 14px;
            }

            .auth-submit-wrap :global(.auth-submit-btn),
            .auth-submit-wrap :global(button) {
              padding: 12px 16px;
            }
          }

          @media (max-width: 480px) {
            .admin-login-overlay {
              padding: 10px;
              padding-top: max(10px, env(safe-area-inset-top, 0px));
              padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
            }

            .login-logo-ring {
              width: 84px;
              height: 84px;
            }

            .login-brand-panel {
              padding: 12px 14px 8px;
            }

            .login-form-panel {
              padding: 12px 14px 16px;
            }

            .login-form-inner h3 {
              font-size: 20px;
            }
          }
        `}</style>
      </div>
    );
  }

  const getTopSellingCreations = () => {
    const itemsMap = {};
    const sourceOrders = dashboardOrders.length > 0 ? dashboardOrders : activeOrders;
    sourceOrders.forEach((order) => {
      if (!order.createdAt || isOrderCancelled(order.status)) return;
      if (order.itemsList && Array.isArray(order.itemsList)) {
        order.itemsList.forEach((item) => {
          const addonTotal = (item.selected_addons || []).reduce(
            (sum, addon) => sum + parseFloat(addon?.price || 0),
            0
          );
          const unitPrice = parseFloat(item.price || 0) + addonTotal;
          const lineQty = item.quantity || 0;
          if (!itemsMap[item.name]) {
            itemsMap[item.name] = {
              name: item.name,
              orders: 0,
              revenue: 0
            };
          }
          itemsMap[item.name].orders += lineQty;
          itemsMap[item.name].revenue += lineQty * unitPrice;
        });
      }
    });

    return Object.values(itemsMap)
      .sort((a, b) => b.orders - a.orders)
      .map((item, index) => ({
        rank: index + 1,
        name: item.name,
        orders: item.orders,
        rev: `₹${item.revenue.toFixed(2)}`
      }));
  };

  const topSellingCreations = getTopSellingCreations();

  const renderEmptyState = (message = "No records found") => (
    <div className="glass-effect" style={{
      padding: "40px 20px",
      textAlign: "center",
      borderRadius: "8px",
      border: "1px solid rgba(1, 30, 2, 0.2)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      marginTop: "20px"
    }}>
      <Inbox className="text-muted" size={40} style={{ opacity: 0.5, color: "rgba(255,255,255,0.5)" }} />
      <h5 style={{ margin: 0, fontSize: "16px", color: "rgba(255, 255, 255, 0.8)", fontFamily: "var(--font-poppins)" }}>{message}</h5>
      <p style={{ margin: 0, fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", maxWidth: "300px", lineHeight: "1.5" }}>
        Adjust your search filters or check again later.
      </p>
    </div>
  );

  const renderOrderIdCell = (order) => {
    const displayId = order.displayOrderId || formatOrderNumber(order.orderNumber);
    return (
      <span className="order-id-text font-gold">
        {displayId || "—"}
      </span>
    );
  };

  // Filters for Orders
  const getFilteredOrders = () => {
    let list = activeOrders;

    // Status filters
    if (orderFilter !== "All") {
      list = list.filter(o => {
        if (orderFilter === "Pending") return isPendingOrderStatus(o.status);
        if (orderFilter === "Delivered") return o.status === "Delivered & Plated" || o.status === "Delivered";
        if (orderFilter === "Cancelled") return isOrderCancelled(o.status);
        return true;
      });
    }
    // Search filter
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      list = list.filter(o => 
        o.id.toLowerCase().includes(q) || 
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q)
      );
    }
    return list;
  };

  const filteredOrdersList = getFilteredOrders();

  // Filters for Products (uses localProducts for instant optimistic stock updates)
  const filteredProductsList = localProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.categoryName.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Filters for Customers
  const getFilteredCustomers = () => {
    let list = customers;
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    }
    return list;
  };
  const filteredCustomersList = getFilteredCustomers();

  // Filters for Payments
  const getFilteredPayments = () => {
    let list = payments;
    if (paymentSearch.trim()) {
      const q = paymentSearch.toLowerCase();
      list = list.filter(p =>
        (p.customerName && p.customerName.toLowerCase().includes(q)) ||
        (p.customerPhone && p.customerPhone.includes(q)) ||
        p.orderId.toLowerCase().includes(q) ||
        p.paymentId.toLowerCase().includes(q)
      );
    }
    return list;
  };
  const filteredPaymentsList = getFilteredPayments();

  // Filters for Categories
  const getFilteredCategories = () => {
    let list = localCategories;
    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return list;
  };
  const filteredCategoriesList = getFilteredCategories();

  // Filters for Addons
  const getFilteredAddons = () => {
    let list = localAddons;
    if (addonCategoryFilter !== "all") {
      const filterId = parseInt(addonCategoryFilter, 10);
      list = list.filter((a) => Number(a.category_id) === filterId);
    }
    if (addonSearch.trim()) {
      const q = addonSearch.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const catA = String(resolveAddonCategoryName(a) || "").toLowerCase();
      const catB = String(resolveAddonCategoryName(b) || "").toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  };
  const filteredAddonsList = getFilteredAddons();
  const productCategories = localCategories.filter((c) => !isAddonGroupCategory(c.name));
  const addonCategories = [
    ...localCategories.filter((c) => isAddonGroupCategory(c.name)),
    ...categories.filter((c) => !isAddonGroupCategory(c.name))
  ];

  function resolveAddonCategoryName(add) {
    if (add?.categoryName) return add.categoryName;
    if (add?.categories?.name) return add.categories.name;
    const linked = categories.find((c) => Number(c.id) === Number(add?.category_id));
    return linked?.name || null;
  }

  // Filters for Coupons
  const getFilteredCoupons = () => {
    let list = coupons;
    if (couponSearch.trim()) {
      const q = couponSearch.toLowerCase();
      list = list.filter(c => 
        c.code.toLowerCase().includes(q) || 
        (c.phone_restriction && c.phone_restriction.includes(q))
      );
    }
    return list;
  };
  const filteredCouponsList = getFilteredCoupons();

  // Filters for Coins
  const getFilteredCoinsList = () => {
    let list = customers;
    if (coinSearch.trim()) {
      const q = coinSearch.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone.includes(q)
      );
    }
    return list;
  };
  const filteredCoinsList = getFilteredCoinsList();

  // Filters for Business Updates
  const getFilteredUpdates = () => {
    let list = updates || [];
    if (updateSearch.trim()) {
      const q = updateSearch.toLowerCase();
      list = list.filter(u => 
        u.title.toLowerCase().includes(q) || 
        (u.subtitle && u.subtitle.toLowerCase().includes(q)) || 
        u.content.toLowerCase().includes(q) ||
        u.tag.toLowerCase().includes(q)
      );
    }
    return list;
  };
  const filteredUpdatesList = getFilteredUpdates();

  // Filters for Pop-up Events
  const getFilteredEvents = () => {
    let list = events || [];
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase();
      list = list.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.location.toLowerCase().includes(q) || 
        e.description.toLowerCase().includes(q)
      );
    }
    return list;
  };
  const filteredEventsList = getFilteredEvents();

  return (
    <div className="admin-console-layout">
      {/* Sidebar Navigation */}
      <aside className={`console-sidebar glass-dark-effect ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="navbar-logo-text admin-sidebar-logo">
            <BrandName inline={false} showTelugu />
          </div>
          <button className="sidebar-close-btn-mobile" onClick={() => setIsSidebarOpen(false)} aria-label="Close Sidebar" style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", display: "none" }}>
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav-links">
          {[
            { id: "dashboard", label: "Dashboard", icon: <Inbox size={16} /> },
            { id: "orders", label: `Orders (${activeOrders.length})`, icon: <ShoppingBag size={16} /> },
            { id: "products", label: "Items", icon: <Tag size={16} /> },
            { id: "categories", label: "Categories", icon: <Filter size={16} /> },
            { id: "addons", label: "Add-ons", icon: <Plus size={16} /> },
            { id: "coupons", label: "Coupons", icon: <Tag size={16} /> },
            { id: "coins", label: "Coins Rewards", icon: <Award size={16} /> },
            { id: "customers", label: "Customers", icon: <Users size={16} /> },
            { id: "payments", label: "Payments", icon: <IndianRupee size={16} /> },
            { id: "updates", label: "Business Updates", icon: <Calendar size={16} /> },
            { id: "events", label: "Pop-up Events", icon: <Calendar size={16} /> },
            { id: "upcoming", label: "Upcoming Items", icon: <Calendar size={16} /> },
            { id: "contacts", label: `Inquiries (${contacts.length})`, icon: <MessageSquare size={16} /> },
            { id: "time-slots", label: "Time Slots", icon: <Clock size={16} /> },
            { id: "settings", label: "Console Settings", icon: <Settings size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsSidebarOpen(false);
              }}
              className={`sidebar-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={() => { handleLogout(); setIsSidebarOpen(false); }}>
            <LogOut size={16} /> Logout Console
          </button>
        </div>
      </aside>

      {/* Sidebar mobile backdrop overlay */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop-mobile" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Main Console Content */}
      <main className="console-main-content">
        <header className="console-header-bar">
          <div className="header-meta" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <button className="sidebar-toggle-trigger" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle Sidebar">
              <Menu size={20} />
            </button>
            <div>
              <span className="header-subtitle-tag">ADMIN ACCESS GRANTED</span>
              <h1 className="header-title">Owner Control Center</h1>
            </div>
          </div>
          <div className="header-actions">
          </div>
        </header>

        <div className="admin-data-container" style={{ position: "relative", flex: 1 }}>
          {isSyncing && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 900,
              background: "rgba(10, 11, 9, 0.75)", backdropFilter: "blur(4px)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: "15vh",
              borderRadius: "12px"
            }}>
              <div className="admin-compact-loader-spinner" style={{ width: "45px", height: "45px" }} />
              <p style={{ marginTop: "16px", color: "var(--accent-gold)", fontWeight: 600, letterSpacing: "1px", fontSize: "14px" }}>SYNCING DATA...</p>
            </div>
          )}

          {/* ========================================================
            TAB 1: DASHBOARD OVERVIEW (HOME)
            ======================================================== */}
        {activeTab === "dashboard" && (
          <div className="console-tab-pane">
            <div style={{ marginBottom: "18px" }}>
              <AdminDateRangeFilter
                value={sectionDateRanges.dashboard}
                onChange={(next) => updateSectionDateRange("dashboard", next)}
                onApply={(override) => applySectionDateRange("dashboard", override)}
                isSyncing={isSyncing}
              />
            </div>
            <div className="analytics-overview-row">
              <div className="metric-panel glass-effect">
                <span className="label">{statsPeriodLabel} Revenue</span>
                <span className="value">₹{formatPrice(stats?.todayRevenue)}</span>
              </div>
              <div className="metric-panel glass-effect">
                <span className="label">{statsPeriodLabel} Orders</span>
                <span className="value">{stats ? stats.todayOrdersCount : 0}</span>
              </div>
              <div className="metric-panel glass-effect">
                <span className="label">Pending Orders</span>
                <span className="value font-gold">{stats ? stats.pendingOrdersCount : 0}</span>
              </div>
              <div className="metric-panel glass-effect">
                <span className="label">Delivered</span>
                <span className="value font-green">{stats ? stats.deliveredOrdersCount : 0}</span>
              </div>
              <div className="metric-panel glass-effect">
                <span className="label">Cancelled</span>
                <span className="value font-red">{stats ? stats.cancelledOrdersCount : 0}</span>
              </div>
              <div className="metric-panel glass-effect">
                <span className="label">Guests ({statsPeriodLabel})</span>
                <span className="value">{stats ? stats.todayCustomersCount : 0}</span>
              </div>
              <div className="metric-panel glass-effect">
                <span className="label">Rewards Coins Issued</span>
                <span className="value">{stats ? stats.todayCoinsIssued : 0}</span>
              </div>
            </div>

            <div className="dashboard-charts-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "25px" }}>
              {/* Order status proportion */}
              <div className="chart-card glass-effect">
                <h4>Order Queue Allocation</h4>
                <div className="allocation-list" style={{ marginTop: "15px" }}>
                  {[
                    { label: "Pending", count: stats?.pendingOrdersCount || 0, color: "rgba(255,255,255,0.7)" },
                    { label: "Delivered", count: stats?.deliveredOrdersCount || 0, color: "rgba(255,255,255,0.5)" },
                    { label: "Cancelled", count: stats?.cancelledOrdersCount || 0, color: "rgba(255,255,255,0.4)" }
                  ].map((stat, i) => (
                    <div key={i} className="alloc-row" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: stat.color }}></span>
                        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{stat.label}</span>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: "600" }}>{stat.count} orders</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Popular items and recent list */}
            <div className="dashboard-grid-two-cols" style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "25px" }}>
              <div className="recent-orders-mini-card glass-effect" style={{ padding: "20px", borderRadius: "8px" }}>
                <h4 style={{ marginBottom: "15px" }}>Pending Orders</h4>
                <div className="table-responsive">
                  {pendingOrdersList.length === 0 ? (
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: 0 }}>No pending orders right now.</p>
                  ) : (
                    <table className="console-custom-table">
                      <thead>
                        <tr>
                          <th>Guest</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingOrdersList.slice(0, 8).map(o => (
                          <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => { setActiveTab("orders"); setSelectedOrder(o); }}>
                            <td>{o.customerName}</td>
                            <td>₹{formatPrice(o?.grandTotal)}</td>
                            <td><span className={`status-pill ${o.statusClass}`}>{o.status}</span></td>
                            <td>{o.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="popular-items-card glass-effect" style={{ padding: "20px", borderRadius: "8px" }}>
                <h4 style={{ margin: "0 0 15px 0" }}>Top Selling Creations</h4>
                <div className="popular-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {topSellingCreations.length === 0 ? (
                    <div style={{ padding: "20px 10px", textAlign: "center", color: "rgba(255, 255, 255, 0.4)", fontSize: "12px" }}>
                      No checkouts in this date range
                    </div>
                  ) : (
                    topSellingCreations.map(item => (
                      <div key={item.rank} style={{ display: "flex", alignItems: "center", justifySpace: "between", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: "600", marginRight: "15px" }}>#{item.rank}</span>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: 0, fontSize: "13px" }}>{item.name}</h5>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{item.orders} checkouts</span>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "600" }}>{item.rev}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: ORDERS MANAGEMENT
            ======================================================== */}
        {activeTab === "orders" && (
          <div className="console-tab-pane">
            <div className="filters-bar glass-effect orders-filters-bar">
              <div className="orders-search-date-row">
                <div className="search-box-wrapper orders-search-input">
                  <Search size={14} className="text-muted" style={{ marginRight: "10px", flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search ID, Name, Phone..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                </div>
                <AdminDateRangeFilter
                  value={sectionDateRanges.orders}
                  onChange={(next) => updateSectionDateRange("orders", next)}
                  onApply={(override) => applySectionDateRange("orders", override)}
                  isSyncing={isSyncing}
                  compact
                />
              </div>
              <div className="filter-tabs">
                {["All", "Pending", "Delivered", "Cancelled"].map(f => (
                  <button 
                    key={f}
                    type="button"
                    onClick={() => setOrderFilter(f)}
                    className={`filter-tab-btn ${orderFilter === f ? "active" : ""}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredOrdersList.length === 0 ? (
              renderEmptyState("No orders found matching the filter")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Order Number</th>
                      <th>Customer Name</th>
                      <th>Phone</th>
                      <th>Address</th>
                      <th>Grand Total</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrdersList.map(order => (
                      <tr key={order.id}>
                        <td>{renderOrderIdCell(order)}</td>
                        <td>{order.customerName}</td>
                        <td>{order.customerPhone}</td>
                        <td className="truncate-text" style={{ maxWidth: "200px" }}>
                          {order.location && order.location.includes(" || Map: ") ? (
                            <>
                              {order.location.split(" || Map: ")[0]}{" "}
                              <a href={order.location.split(" || Map: ")[1]} target="_blank" rel="noopener noreferrer" style={{ color: "#d4af37", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>[Map]</a>
                            </>
                          ) : order.location}
                        </td>
                        <td>₹{formatPrice(order?.grandTotal)}</td>
                        <td>
                          {renderOrderStatusControl(order)}
                        </td>
                        <td>{order.date}</td>
                        <td>
                          <div className="order-row-actions-cell">
                            <button className="icon-action-btn" onClick={() => setSelectedOrder(order)} title="View full details">
                              <Eye size={14} />
                            </button>
                            {!isOrderCancelled(order.status) ? (
                              <button
                                type="button"
                                className="icon-action-btn delete order-cancel-btn"
                                disabled={isActionLoading(`order-status-${order.id}`)}
                                onClick={() => markOrderCancelled(order)}
                                title="Cancel order"
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="icon-action-btn order-undo-btn admin-surface-light"
                                disabled={isActionLoading(`order-status-${order.id}`)}
                                onClick={() => undoCancelledOrder(order)}
                                title="Restore to Pending"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: ITEMS MANAGEMENT
            ======================================================== */}
        {activeTab === "products" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "300px" }}>
                  <Search size={14} className="text-muted" style={{ marginRight: "10px" }} />
                  <input 
                    type="text" 
                    placeholder="Search Items..." 
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                  />
                </div>
              </div>
              <button className="btn-primary" onClick={() => { setProductImageUploading(false); setProductForm({ mode: "create", name: "", price: "", sizePricesRaw: "", sizeGramsRaw: "120,180,210", sizeCaloriesRaw: "", category_id: productCategories[0]?.id || categories.find((c) => !isAddonGroupCategory(c.name))?.id || 1, calories: "", rating: "4.8", description: "", image: "", in_stock: true, quantity: 100, subCategory: "regular", protein: "", carbohydrates: "", fats: "", ingredients: "", serving_size: "", serving_weight_g: "", total_weight_g: "", saturated_fat: "", sugar: "", dietary_fibre: "", sodium_mg: "" }); }}>
                <Plus size={16} /> Add Item
              </button>
            </div>

            {filteredProductsList.length === 0 ? (
              renderEmptyState("No items found matching the search")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Size Prices (₹)</th>
                      <th>Calories</th>
                      <th>Weight (g)</th>
                      <th>Show Menu</th>
                      <th>Stock status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProductsList.map(prod => {
                      const showInMenu = prod.show_in_menu !== false;
                      return (
                      <tr key={prod.id}>
                        <td><img src={resolveProductImage(prod.image, prod.categoryName, prod.name)} alt={prod.name} style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover" }} /></td>
                        <td><strong>{prod.name}</strong></td>
                        <td>{prod.categoryName}</td>
                        <td>{formatVisibleSizePrices(prod.sizePricesRaw, prod.sizes, prod.price)}</td>
                        <td>
                          {prod.sizeCaloriesRaw ||
                          (prod.sizes?.some((s) => s.calories != null)
                            ? prod.sizes.map((s) => s.calories).join(", ")
                            : null) ||
                          (prod.calories != null ? String(prod.calories) : null)
                            ? `${
                                prod.sizeCaloriesRaw ||
                                (prod.sizes?.some((s) => s.calories != null)
                                  ? prod.sizes.map((s) => s.calories).join(", ")
                                  : String(prod.calories))
                              } kcal`
                            : "—"}
                        </td>
                        <td>
                          {isCookiesCategory(prod.categoryName)
                            ? "approx 180g-200g"
                            : prod.sizeGramsRaw ||
                              prod.sizes?.map((s) => s.grams).filter((g) => g != null).join(", ") ||
                              "—"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`catalog-display-toggle ${showInMenu ? "is-on" : "is-off"}`}
                            onClick={() => handleProductVisibilityToggle(prod)}
                            disabled={isActionLoading(`product-visibility-${prod.id}`)}
                            aria-pressed={showInMenu}
                            title="ON = show this item in the customer menu. OFF = hide it completely."
                          >
                            <span className="catalog-display-toggle-label">Menu</span>
                            <span className="catalog-display-toggle-state">{showInMenu ? "ON" : "OFF"}</span>
                          </button>
                        </td>
                        <td>
                          <LoadingButton
                            onClick={() => handleStockToggle(prod)}
                            className={`stock-toggle-pill ${prod.in_stock ? "active" : "sold-out"}`}
                            loading={isActionLoading(`stock-${prod.id}`)}
                            loadingText="Updating…"
                          >
                            {prod.in_stock ? "In Stock" : "Sold Out"}
                          </LoadingButton>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button className="icon-action-btn edit" onClick={() => { setProductImageUploading(false); setProductForm({
                              mode: "edit",
                              id: prod.id,
                              ...prod,
                              sizePricesRaw: prod.sizePricesRaw || "",
                              sizeGramsRaw: prod.sizeGramsRaw || prod.sizes?.map((s) => s.grams).filter(Boolean).join(", ") || extractSizeGramsRaw(prod.description || "") || "",
                              sizeCaloriesRaw:
                                prod.sizeCaloriesRaw ||
                                prod.sizes?.map((s) => s.calories).filter((c) => c != null).join(", ") ||
                                extractSizeCaloriesRaw(prod.description || "") ||
                                "",
                              calories:
                                prod.sizeCaloriesRaw ||
                                prod.sizes?.map((s) => s.calories).filter((c) => c != null).join(", ") ||
                                (prod.calories != null ? String(prod.calories) : ""),
                              quantity: prod.quantity ?? 100,
                              protein: prod.protein ?? "",
                              carbohydrates: prod.carbohydrates ?? "",
                              fats: prod.fats ?? "",
                              ingredients: prod.ingredients ?? "",
                              serving_size: prod.serving_size ?? "",
                              serving_weight_g: prod.serving_weight_g ?? "",
                              total_weight_g: prod.total_weight_g ?? "",
                              saturated_fat: prod.saturated_fat ?? "",
                              sugar: prod.sugar ?? "",
                              dietary_fibre: prod.dietary_fibre ?? "",
                              sodium_mg: prod.sodium_mg ?? ""
                            }); }}>Edit</button>
                            <button className="icon-action-btn delete" onClick={() => handleProductDelete(prod.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PRODUCT EDIT/CREATE FORM OVERLAY */}
            {productForm && (
              <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
                <div className="form-modal-box admin-form-modal admin-form-modal--wide glass-dark-effect" onClick={(e) => e.stopPropagation()}>
                  <FormModalCloseButton onClick={dismissAdminOverlay} />
                  <h4>{productForm.mode === "create" ? "Create Item" : "Modify Item"}</h4>
                  <form onSubmit={handleProductSubmit} noValidate>
                    {(() => {
                      const selectedCatName =
                        categories.find((c) => String(c.id) === String(productForm.category_id))
                          ?.name || "";
                      const singlePriceForm =
                        isCookiesCategory(selectedCatName) || isBreadsCategory(selectedCatName);
                      const cookieForm = isCookiesCategory(selectedCatName);
                      return (
                    <>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Item Name</label>
                        <input type="text" value={productForm.name} onChange={(e)=>setProductForm({...productForm, name: e.target.value})} />
                      </div>
                      <div className="input-group">
                        <label>{singlePriceForm ? "Price (₹)" : "Size Prices — Small, Medium, Large (₹)"}</label>
                        <input
                          type="text"
                          inputMode={cookieForm ? "text" : "decimal"}
                          placeholder={singlePriceForm ? "e.g. 79" : "e.g. 90,120,150"}
                          value={
                            singlePriceForm
                              ? cookieForm
                                ? productForm.sizePricesRaw ?? ""
                                : String(productForm.sizePricesRaw || "").split(",")[0] || ""
                              : productForm.sizePricesRaw ?? ""
                          }
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              sizePricesRaw: singlePriceForm
                                ? cookieForm
                                  ? e.target.value
                                  : sanitizeSizePricesInput(e.target.value).split(",")[0] || ""
                                : sanitizeSizePricesInput(e.target.value),
                            })
                          }
                          onBlur={() =>
                            setProductForm((prev) => ({
                              ...prev,
                              sizePricesRaw: singlePriceForm
                                ? cookieForm
                                  ? prev.sizePricesRaw
                                  : normalizeSizePricesInput(
                                      String(prev.sizePricesRaw || "").split(",")[0] || ""
                                    )
                                : normalizeSizePricesInput(prev.sizePricesRaw),
                            }))
                          }
                        />
                        <small style={{ display: "block", marginTop: "6px", color: "rgba(255,255,255,0.45)", fontSize: "11px" }}>
                          {singlePriceForm
                            ? "Optional. Enter one unit price shown to customers."
                            : "Optional. Leave blank to clear all prices. Use 0 or empty slots to hide a size (e.g. 90,0,150)."}
                        </small>
                      </div>
                      {cookieForm && (
                      <div className="input-group">
                        <label>Total Weight (g)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="e.g. 80"
                          value={productForm.total_weight_g ?? ""}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              total_weight_g: sanitizeDecimalInput(e.target.value),
                            })
                          }
                        />
                        <small style={{ display: "block", marginTop: "6px", color: "rgba(255,255,255,0.45)", fontSize: "11px" }}>
                          Package weight shown below price on the menu. Not serving size or serving weight.
                        </small>
                      </div>
                      )}
                      {!singlePriceForm && (
                      <div className="input-group">
                        <label>Size Portion Grams — Small, Medium, Large (g)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 200,300,400"
                          value={productForm.sizeGramsRaw ?? ""}
                          onChange={(e) => setProductForm({ ...productForm, sizeGramsRaw: sanitizeSizeGramsInput(e.target.value) })}
                          onBlur={() =>
                            setProductForm((prev) => ({
                              ...prev,
                              sizeGramsRaw: normalizeSizeGramsInput(prev.sizeGramsRaw)
                            }))
                          }
                        />
                        <small style={{ display: "block", marginTop: "6px", color: "rgba(255,255,255,0.45)", fontSize: "11px" }}>
                          Optional. Food weight per size shown to customers.
                        </small>
                      </div>
                      )}
                    </div>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Category</label>
                        <select value={productForm.category_id} onChange={(e)=>setProductForm({...productForm, category_id: e.target.value})}>
                          {productCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>{singlePriceForm ? "Calories (kcal)" : "Calories — Small, Medium, Large (kcal)"}</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder={singlePriceForm ? "e.g. 180" : "e.g. 320,380,420"}
                          value={
                            singlePriceForm
                              ? String(productForm.sizeCaloriesRaw ?? productForm.calories ?? "").split(",")[0] || ""
                              : productForm.sizeCaloriesRaw ?? productForm.calories ?? ""
                          }
                          onChange={(e) => {
                            const next = singlePriceForm
                              ? sanitizeSizeCaloriesInput(e.target.value).split(",")[0] || ""
                              : sanitizeSizeCaloriesInput(e.target.value);
                            setProductForm({
                              ...productForm,
                              sizeCaloriesRaw: next,
                              calories: next,
                            });
                          }}
                          onBlur={() =>
                            setProductForm((prev) => {
                              const raw = singlePriceForm
                                ? String(prev.sizeCaloriesRaw || prev.calories || "").split(",")[0] || ""
                                : prev.sizeCaloriesRaw || prev.calories;
                              const normalized = normalizeSizeCaloriesInput(raw);
                              return {
                                ...prev,
                                sizeCaloriesRaw: normalized,
                                calories: normalized,
                              };
                            })
                          }
                        />
                        <small style={{ display: "block", marginTop: "6px", color: "rgba(255,255,255,0.45)", fontSize: "11px" }}>
                          Optional. Leave blank if you do not want calories shown yet.
                        </small>
                      </div>
                    </div>
                    </>
                      );
                    })()}
                    <div className="form-row">
                      <div className="input-group">
                        <label>Rating (1.0 - 5.0)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={productForm.rating}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              rating: sanitizeDecimalInput(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="form-row form-row-full">
                      <ProductImageUpload
                        imageUrl={productForm.image || ""}
                        onImageUrlChange={(url) => setProductForm((prev) => ({ ...prev, image: url }))}
                        onUploadingChange={setProductImageUploading}
                      />
                    </div>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Protein (g)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={productForm.protein}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              protein: sanitizeDecimalInput(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="input-group">
                        <label>Carbohydrates (g)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={productForm.carbohydrates}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              carbohydrates: sanitizeDecimalInput(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="input-group">
                        <label>
                          {isCookiesCategory(
                            categories.find((c) => String(c.id) === String(productForm.category_id))?.name
                          )
                            ? "Total Fat (g)"
                            : "Fats (g)"}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={productForm.fats}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              fats: sanitizeDecimalInput(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    {isCookiesCategory(
                      categories.find((c) => String(c.id) === String(productForm.category_id))?.name
                    ) && (
                      <>
                        <div className="form-row">
                          <div className="input-group">
                            <label>Serving Size</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="e.g. 2"
                              value={productForm.serving_size ?? ""}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  serving_size: sanitizeDecimalInput(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label>Serving Weight (g)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="e.g. 40"
                              value={productForm.serving_weight_g ?? ""}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  serving_weight_g: sanitizeDecimalInput(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label>Saturated Fat (g)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={productForm.saturated_fat ?? ""}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  saturated_fat: sanitizeDecimalInput(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="input-group">
                            <label>Sugar (g)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={productForm.sugar ?? ""}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  sugar: sanitizeDecimalInput(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label>Dietary Fibre (g)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={productForm.dietary_fibre ?? ""}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  dietary_fibre: sanitizeDecimalInput(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="input-group">
                            <label>Sodium (mg)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={productForm.sodium_mg ?? ""}
                              onChange={(e) =>
                                setProductForm({
                                  ...productForm,
                                  sodium_mg: sanitizeDecimalInput(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                     <div className="input-group">
                      <label>Dietary Description</label>
                      <textarea rows="3" value={productForm.description} onChange={(e)=>setProductForm({...productForm, description: e.target.value})} />
                    </div>
                     <div className="input-group">
                      <label>Ingredients (comma separated)</label>
                      <textarea rows="3" placeholder="e.g. Rolled oats, Almond milk, Fresh berries" value={productForm.ingredients} onChange={(e)=>setProductForm({...productForm, ingredients: e.target.value})} />
                    </div>
                    {categories.find(c => c.id === parseInt(productForm.category_id))?.name?.toLowerCase() === "oats" && (
                      <div className="input-group" style={{ marginTop: "15px" }}>
                        <label>Oats Sub-category</label>
                        <select
                          value={productForm.subCategory || "regular"}
                          onChange={(e) => setProductForm({ ...productForm, subCategory: e.target.value })}
                        >
                          <option value="regular">Regular</option>
                          <option value="oats signature">Oats Signature</option>
                        </select>
                      </div>
                    )}
                    <div className="checkbox-group" style={{ margin: "15px 0" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                        <input type="checkbox" checked={productForm.in_stock} onChange={(e)=>setProductForm({...productForm, in_stock: e.target.checked})} />
                        Is Available in Kitchen
                      </label>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn-secondary" onClick={dismissAdminOverlay}>Cancel</button>
                      <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("product-submit") || productImageUploading} loadingText={productImageUploading ? "Uploading Image…" : "Saving…"}>
                        Save Changes
                      </LoadingButton>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 4: CATEGORIES MANAGEMENT
            ======================================================== */}
        {activeTab === "categories" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
                <h4>Fine Dining Categories ({categories.length})</h4>
                <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "250px" }}>
                  <Search size={14} className="text-muted" style={{ marginRight: "10px", color: "rgba(255,255,255,0.5)" }} />
                  <input 
                    type="text" 
                    placeholder="Search Categories..." 
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                  />
                </div>
              </div>
              <button className="btn-primary" onClick={() => setCategoryForm({ mode: "create", name: "" })}>
                <Plus size={16} /> Add Category
              </button>
            </div>

            {filteredCategoriesList.length === 0 ? (
              renderEmptyState("No categories found")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px", maxWidth: "1280px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Category Name</th>
                      <th>Category Title</th>
                      <th>Show Menu</th>
                      <th>Calories</th>
                      <th>Grams</th>
                      <th>Ingredients</th>
                      <th>Nutrients</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategoriesList.map(c => {
                      const showInMenu = c.show_in_menu !== false;
                      // Menu OFF ⇒ Title always shows OFF in admin
                      const showSection = showInMenu && Boolean(c.show_section);
                      const showCalories = c.show_calories !== false;
                      const showGrams = c.show_grams !== false;
                      const showIngredients = c.show_ingredients !== false;
                      const showNutrients = c.show_nutrients !== false;
                      return (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td><strong>{c.name}</strong></td>
                        <td>
                          <button
                            type="button"
                            className={`catalog-display-toggle ${showSection ? "is-on" : "is-off"}`}
                            onClick={() => handleCategoryVisibilityToggle(c, "show_section")}
                            disabled={
                              !showInMenu ||
                              isActionLoading(`category-visibility-${c.id}-show_section`) ||
                              isActionLoading(`category-visibility-${c.id}-show_in_menu`)
                            }
                            aria-pressed={showSection}
                            title={
                              showInMenu
                                ? "ON = show this category tab in the Menu filters"
                                : "Turn Show Menu ON first to enable Category Title"
                            }
                          >
                            <span className="catalog-display-toggle-label">Title</span>
                            <span className="catalog-display-toggle-state">{showSection ? "ON" : "OFF"}</span>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`catalog-display-toggle ${showInMenu ? "is-on" : "is-off"}`}
                            onClick={() => handleCategoryVisibilityToggle(c, "show_in_menu")}
                            disabled={
                              isActionLoading(`category-visibility-${c.id}-show_in_menu`) ||
                              isActionLoading(`category-visibility-${c.id}-show_section`)
                            }
                            aria-pressed={showInMenu}
                            title="ON = include this category's items in the Menu. OFF = hide items and turn Category Title OFF."
                          >
                            <span className="catalog-display-toggle-label">Menu</span>
                            <span className="catalog-display-toggle-state">{showInMenu ? "ON" : "OFF"}</span>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`catalog-display-toggle ${showCalories ? "is-on" : "is-off"}`}
                            onClick={() => handleCategoryDisplayToggle(c, "show_calories")}
                            disabled={isActionLoading(`category-visibility-${c.id}-show_calories`)}
                            aria-pressed={showCalories}
                            title="ON = show calories for items in this category on the storefront"
                          >
                            <span className="catalog-display-toggle-label">Calories</span>
                            <span className="catalog-display-toggle-state">{showCalories ? "ON" : "OFF"}</span>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`catalog-display-toggle ${showGrams ? "is-on" : "is-off"}`}
                            onClick={() => handleCategoryDisplayToggle(c, "show_grams")}
                            disabled={isActionLoading(`category-visibility-${c.id}-show_grams`)}
                            aria-pressed={showGrams}
                            title="ON = show grams for items in this category on the storefront"
                          >
                            <span className="catalog-display-toggle-label">Grams</span>
                            <span className="catalog-display-toggle-state">{showGrams ? "ON" : "OFF"}</span>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`catalog-display-toggle ${showIngredients ? "is-on" : "is-off"}`}
                            onClick={() => handleCategoryDisplayToggle(c, "show_ingredients")}
                            disabled={isActionLoading(`category-visibility-${c.id}-show_ingredients`)}
                            aria-pressed={showIngredients}
                            title="ON = show Ingredients tab for all items in this category"
                          >
                            <span className="catalog-display-toggle-label">Ingredients</span>
                            <span className="catalog-display-toggle-state">{showIngredients ? "ON" : "OFF"}</span>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`catalog-display-toggle ${showNutrients ? "is-on" : "is-off"}`}
                            onClick={() => handleCategoryDisplayToggle(c, "show_nutrients")}
                            disabled={isActionLoading(`category-visibility-${c.id}-show_nutrients`)}
                            aria-pressed={showNutrients}
                            title="ON = show Nutrients / Nutrition tab for all items in this category"
                          >
                            <span className="catalog-display-toggle-label">Nutrients</span>
                            <span className="catalog-display-toggle-state">{showNutrients ? "ON" : "OFF"}</span>
                          </button>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button className="icon-action-btn edit" onClick={() => setCategoryForm({ mode: "edit", id: c.id, name: c.name })}>Rename</button>
                            <button className="icon-action-btn delete" onClick={() => handleCategoryDelete(c.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* CATEGORY FORM OVERLAY */}
            {categoryForm && (
              <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
                <div className="form-modal-box admin-form-modal glass-dark-effect" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
                  <FormModalCloseButton onClick={dismissAdminOverlay} />
                  <h4>{categoryForm.mode === "create" ? "Create Category" : "Modify Category"}</h4>
                  <form onSubmit={handleCategorySubmit}>
                    <div className="input-group">
                      <label>Category Label</label>
                      <input type="text" value={categoryForm.name} onChange={(e)=>setCategoryForm({...categoryForm, name: e.target.value})} required />
                    </div>
                    <div className="form-actions" style={{ marginTop: "20px" }}>
                      <button type="button" className="btn-secondary" onClick={()=>setCategoryForm(null)}>Cancel</button>
                      <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("category-submit")} loadingText="Saving…">Save</LoadingButton>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 5: ADDONS MANAGEMENT
            ======================================================== */}
        {activeTab === "addons" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
                <h4>Ingredients & Add-ons Upgrade</h4>
                <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "250px" }}>
                  <Search size={14} className="text-muted" style={{ marginRight: "10px", color: "rgba(255,255,255,0.5)" }} />
                  <input 
                    type="text" 
                    placeholder="Search Add-ons..." 
                    value={addonSearch}
                    onChange={(e) => setAddonSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                  />
                </div>
                <select
                  value={addonCategoryFilter}
                  onChange={(e) => setAddonCategoryFilter(e.target.value)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "7px 12px",
                    fontSize: "13px",
                    outline: "none"
                  }}
                >
                  <option value="all">All Categories</option>
                  {addonCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn-primary"
                onClick={() => {
                  const fruits = categories.find((c) => c.name === "Fruits");
                  setAddonForm({
                    mode: "create",
                    category_id: fruits?.id || categories[0]?.id || "",
                    name: "",
                    price: "",
                    calories: "",
                    grams: 30
                  });
                }}
              >
                <Plus size={16} /> Add Addon option
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              <button
                type="button"
                className={`btn-secondary ${addonCategoryFilter === "all" ? "active" : ""}`}
                onClick={() => setAddonCategoryFilter("all")}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  borderColor: addonCategoryFilter === "all" ? "var(--accent-gold, #c9a227)" : undefined,
                  color: addonCategoryFilter === "all" ? "#fff" : undefined
                }}
              >
                All
              </button>
              {[...ADDON_GROUP_CATEGORIES.filter((n) => n !== "Spreads")].map((name) => {
                const cat = categories.find((c) => c.name === name);
                if (!cat) return null;
                const active = String(addonCategoryFilter) === String(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setAddonCategoryFilter(String(cat.id))}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      borderColor: active ? "var(--accent-gold, #c9a227)" : undefined,
                      color: active ? "#fff" : undefined
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {filteredAddonsList.length === 0 ? (
              renderEmptyState("No add-ons found")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Addon Name</th>
                      <th>Price Upgrade</th>
                      <th>Portion</th>
                      <th>Calories / 100g</th>
                      <th>Show</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAddonsList.map(add => {
                      const categoryLabel = resolveAddonCategoryName(add) || "Uncategorized";
                      const isActive = add.is_active !== false;
                      return (
                        <tr key={add.id}>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                background: "rgba(201, 162, 39, 0.18)",
                                border: "1px solid rgba(201, 162, 39, 0.35)",
                                color: "#f0d78c",
                                fontSize: "12px",
                                fontWeight: 600,
                                letterSpacing: "0.03em"
                              }}
                            >
                              {categoryLabel}
                            </span>
                          </td>
                          <td><strong>{add.name}</strong></td>
                          <td>+₹{formatPrice(add?.price)}</td>
                          <td>{add.grams != null ? `${add.grams}g` : "30g"}</td>
                          <td>{add.calories != null ? `${parseFloat(add.calories)} kcal` : "—"}</td>
                          <td>
                            <button
                              type="button"
                              className={`catalog-display-toggle ${isActive ? "is-on" : "is-off"}`}
                              onClick={() => handleAddonVisibilityToggle(add)}
                              disabled={isActionLoading(`addon-visibility-${add.id}`)}
                              aria-pressed={isActive}
                              title="ON = show this addon when customers customize items. OFF = hide it completely."
                            >
                              <span className="catalog-display-toggle-label">Addon</span>
                              <span className="catalog-display-toggle-state">{isActive ? "ON" : "OFF"}</span>
                            </button>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button className="icon-action-btn edit" onClick={() => setAddonForm({ mode: "edit", id: add.id, ...add, grams: add.grams ?? 30 })}>Edit</button>
                              <button className="icon-action-btn delete" onClick={() => handleAddonDelete(add.id)}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ADDON FORM OVERLAY */}
            {addonForm && (
              <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
                <div className="form-modal-box admin-form-modal glass-dark-effect" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
                  <FormModalCloseButton onClick={dismissAdminOverlay} />
                  <h4>{addonForm.mode === "create" ? "Add Addon upgrade" : "Modify Addon upgrade"}</h4>
                  <form onSubmit={handleAddonSubmit} noValidate>
                    <div className="input-group">
                      <label>Addon Category</label>
                      <select value={addonForm.category_id} onChange={(e)=>setAddonForm({...addonForm, category_id: e.target.value})}>
                        {addonCategories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row" style={{ marginTop: "15px" }}>
                      <div className="input-group">
                        <label>Addon Name</label>
                        <input
                          type="text"
                          value={addonForm.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            const suggestedCalories = lookupAddonCalories(name);
                            setAddonForm({
                              ...addonForm,
                              name,
                              calories: addonForm.calories === "" && suggestedCalories != null
                                ? String(suggestedCalories)
                                : addonForm.calories
                            });
                          }}
                        />
                      </div>
                      <div className="input-group">
                        <label>Upgrade Price (₹)</label>
                        <input type="number" step="0.01" value={addonForm.price} onChange={(e)=>setAddonForm({...addonForm, price: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-row" style={{ marginTop: "15px" }}>
                      <div className="input-group">
                        <label>Portion (g)</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={addonForm.grams ?? 30}
                          onChange={(e)=>setAddonForm({...addonForm, grams: e.target.value})}
                        />
                      </div>
                      <div className="input-group">
                        <label>Avg Calories per 100g</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={addonForm.calories ?? ""}
                          onChange={(e)=>setAddonForm({...addonForm, calories: e.target.value})}
                          placeholder="e.g. 52 for Apple"
                        />
                      </div>
                    </div>
                    <div className="form-actions" style={{ marginTop: "20px" }}>
                      <button type="button" className="btn-secondary" onClick={()=>setAddonForm(null)}>Cancel</button>
                      <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("addon-submit")} loadingText="Saving…">Save</LoadingButton>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 7: COUPONS MANAGEMENT
            ======================================================= */}
        {activeTab === "coupons" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
                <h4>Lounge Coupons Vault</h4>
                <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "250px" }}>
                  <Search size={14} className="text-muted" style={{ marginRight: "10px", color: "rgba(255,255,255,0.5)" }} />
                  <input 
                    type="text" 
                    placeholder="Search Coupons..." 
                    value={couponSearch}
                    onChange={(e) => setCouponSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                  />
                </div>
              </div>
              <button className="btn-primary" onClick={() => setCouponForm({ mode: "create", code: "", discount_percent: "10.0", min_order_amount: "0", is_active: true, phone_restriction: "" })}>
                <Plus size={16} /> Create Coupon
              </button>
            </div>

            {filteredCouponsList.length === 0 ? (
              renderEmptyState("No coupons found")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Coupon Name / Code</th>
                      <th>Discount value</th>
                      <th>Min. Order (₹)</th>
                      <th>Status</th>
                      <th>Phone Restriction</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCouponsList.map(cop => (
                      <tr key={cop.code}>
                        <td><strong className="font-gold">{cop.code}</strong></td>
                        <td>{parseFloat(cop.discount_percent)}% OFF</td>
                        <td>{parseFloat(cop.min_order_amount || 0) > 0 ? `₹${parseFloat(cop.min_order_amount).toFixed(0)}` : "No minimum"}</td>
                        <td><span className={`status-pill ${cop.is_active ? "delivered" : "cancelled"}`}>{cop.is_active ? "Active" : "Disabled"}</span></td>
                        <td>{cop.phone_restriction ? <code>{cop.phone_restriction}</code> : <span className="text-muted">Global (No restriction)</span>}</td>
                        <td>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button className="icon-action-btn edit" onClick={() => setCouponForm({ mode: "edit", originalCode: cop.code, ...cop })}>Edit</button>
                            <button className="icon-action-btn delete" onClick={() => handleCouponDelete(cop.code)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* COUPON FORM OVERLAY */}
            {couponForm && (
              <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
                <div className="form-modal-box admin-form-modal glass-dark-effect" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
                  <FormModalCloseButton onClick={dismissAdminOverlay} />
                  <h4>{couponForm.mode === "create" ? "Create Coupon" : "Modify Coupon"}</h4>
                  <form onSubmit={handleCouponSubmit}>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Coupon Name / Code</label>
                        <input type="text" value={couponForm.code} onChange={(e)=>setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} required />
                      </div>
                      <div className="input-group">
                        <label>Discount (%)</label>
                        <input type="number" step="0.1" value={couponForm.discount_percent} onChange={(e)=>setCouponForm({...couponForm, discount_percent: e.target.value})} required />
                      </div>
                    </div>
                    <div className="input-group" style={{ marginTop: "15px" }}>
                      <label>Minimum Order Amount (₹)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={couponForm.min_order_amount ?? "0"}
                        onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: e.target.value })}
                        placeholder="0 = no minimum"
                      />
                    </div>
                    <div className="input-group" style={{ marginTop: "15px" }}>
                      <label>Restrict to phone (e.g. +15551234567)</label>
                      <input type="text" placeholder="Leave empty for global usage" value={couponForm.phone_restriction || ""} onChange={(e)=>setCouponForm({...couponForm, phone_restriction: e.target.value})} />
                    </div>
                    <div className="checkbox-group" style={{ margin: "15px 0" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                        <input type="checkbox" checked={couponForm.is_active} onChange={(e)=>setCouponForm({...couponForm, is_active: e.target.checked})} />
                        Is Active
                      </label>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn-secondary" onClick={()=>setCouponForm(null)}>Cancel</button>
                      <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("coupon-submit")} loadingText="Saving…">Save Coupon</LoadingButton>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 8: COINS REWARDS
            ======================================================== */}
        {activeTab === "coins" && (
          <div className="console-tab-pane">
            <div className="glass-effect" style={{ borderRadius: "8px", padding: "20px", marginBottom: "24px" }}>
              <h4 style={{ marginBottom: "6px" }}>Coins Redemption Rules</h4>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginBottom: "18px" }}>
                Control when customers can redeem loyalty coins at checkout.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div className="input-group">
                  <label>Minimum Order Amount for Coins (₹)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="1000"
                    value={settingsState.coins_min_order_amount ?? "1000"}
                    onChange={(e) => updateSettingsField("coins_min_order_amount", e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>Coins Redemption</label>
                  <select
                    value={settingsState.coins_redemption_enabled === "false" ? "false" : "true"}
                    onChange={(e) => updateSettingsField("coins_redemption_enabled", e.target.value)}
                    style={getStatusSelectStyle(settingsState.coins_redemption_enabled !== "false")}
                  >
                    <option value="true" style={{ background: "#1B5E20", color: "#fff" }}>Enabled — customers can use coins</option>
                    <option value="false" style={{ background: "#B71C1C", color: "#fff" }}>Disabled — coins cannot be used</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const res = await executeAction({
                    action: "settings-update",
                    settings: {
                      coins_redemption_enabled: settingsState.coins_redemption_enabled ?? "true",
                      coins_min_order_amount: settingsState.coins_min_order_amount ?? "1000"
                    }
                  });
                  if (res.success) alert("Coins redemption settings saved.");
                }}
              >
                Save Coins Settings
              </button>
            </div>

            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h4>Loyalty Wallet Coin Balances</h4>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <AdminDateRangeFilter
                  value={sectionDateRanges.coins}
                  onChange={(next) => updateSectionDateRange("coins", next)}
                  onApply={(override) => applySectionDateRange("coins", override)}
                  isSyncing={isSyncing}
                  compact
                />
                <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "250px" }}>
                <Search size={14} className="text-muted" style={{ marginRight: "10px", color: "rgba(255,255,255,0.5)" }} />
                <input 
                  type="text" 
                  placeholder="Search Phone..." 
                  value={coinSearch}
                  onChange={(e) => setCoinSearch(e.target.value)}
                  style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                />
              </div>
            </div>
            </div>

            {filteredCoinsList.length === 0 ? (
              renderEmptyState("No loyalty wallets found")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Customer Phone</th>
                      <th>Loyalty Coins Balance</th>
                      <th>Total Orders Placed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoinsList.map(w => (
                      <tr key={w.phone}>
                        <td><strong>{w.phone}</strong></td>
                        <td><span className="font-gold" style={{ fontWeight: "600" }}>★ {w.coinsBalance} coins</span></td>
                        <td>{w.ordersCount} checkouts</td>
                        <td>
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button className="btn-status-transition accepted" onClick={() => setCoinAdjustForm({ phone: w.phone, actionType: "add", amount: 100 })}>+ Add</button>
                            <button className="btn-status-transition preparing" onClick={() => setCoinAdjustForm({ phone: w.phone, actionType: "remove", amount: 100 })}>- Remove</button>
                            <button className="btn-status-transition cancelled" onClick={() => {
                              setAppConfirm({
                                message: "Reset this guest's coins balance to zero?",
                                onConfirm: () => {
                                  executeAction({ action: "coin-adjust", phone: w.phone, actionType: "reset", amount: 0 });
                                }
                              });
                            }}>Reset</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* COIN ADJUSTMENT FORM OVERLAY */}
            {coinAdjustForm && (
              <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
                <div className="form-modal-box admin-form-modal glass-dark-effect" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
                  <FormModalCloseButton onClick={dismissAdminOverlay} />
                  <h4>Adjust Coin Wallet</h4>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>Target Guest Phone: <strong>{coinAdjustForm.phone}</strong></p>
                  <form onSubmit={handleCoinAdjustSubmit}>
                    <div className="input-group" style={{ marginTop: "15px" }}>
                      <label>Coins Amount to {coinAdjustForm.actionType === "add" ? "Grant" : "Deduct"}</label>
                      <input type="number" value={coinAdjustForm.amount} onChange={(e)=>setCoinAdjustForm({...coinAdjustForm, amount: e.target.value})} required />
                    </div>
                    <div className="form-actions" style={{ marginTop: "20px" }}>
                      <button type="button" className="btn-secondary" onClick={()=>setCoinAdjustForm(null)}>Cancel</button>
                      <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("coin-adjust")} loadingText="Executing…">Execute</LoadingButton>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 9: CUSTOMERS DATA
            ======================================================== */}
        {activeTab === "customers" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "300px" }}>
                  <Search size={14} className="text-muted" style={{ marginRight: "10px" }} />
                  <input 
                    type="text" 
                    placeholder="Search Phone, Guest Name..." 
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                  />
                </div>
                
                <AdminDateRangeFilter
                  value={sectionDateRanges.customers}
                  onChange={(next) => updateSectionDateRange("customers", next)}
                  onApply={(override) => applySectionDateRange("customers", override)}
                  isSyncing={isSyncing}
                />
              </div>
            </div>

            {filteredCustomersList.length === 0 ? (
              renderEmptyState("No customers found matching the search / date")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Phone</th>
                      <th>Orders placed</th>
                      <th>Total Spendings</th>
                      <th>Wallet Balance</th>
                      <th>Last Order Date</th>
                      <th>Address</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomersList.map(cust => (
                      <tr key={cust.phone}>
                        <td><strong>{cust.name}</strong></td>
                        <td>{cust.phone}</td>
                        <td>{cust.ordersCount} times</td>
                        <td>₹{formatPrice(cust?.totalSpend)}</td>
                        <td><span className="font-gold">★ {cust.coinsBalance} coins</span></td>
                        <td>{cust.lastOrderDate ? new Date(cust.lastOrderDate).toLocaleDateString() : "No Orders"}</td>
                        <td style={{ maxWidth: "220px" }}>
                          {formatAddressForDisplay(cust.address) ? (
                            <div>
                              <p style={{ margin: 0, fontSize: "12px", color: "#ffffff", lineHeight: 1.4 }}>
                                {formatAddressForDisplay(cust.address).slice(0, 60)}
                                {formatAddressForDisplay(cust.address).length > 60 ? "…" : ""}
                              </p>
                              {getMapLinkFromAddress(cust.address) && (
                                <a
                                  href={getMapLinkFromAddress(cust.address)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "6px", color: "#d4af37", fontSize: "11px", fontWeight: 600, textDecoration: "none" }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MapPin size={12} /> View Map
                                </a>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>Not added</span>
                          )}
                        </td>
                        <td>
                          <button className="icon-action-btn" onClick={() => setSelectedCustomer(cust)} title="View customer logs">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CUSTOMER DETAILS DIALOG */}
            {selectedCustomer && (
              <div className="details-overlay-backdrop" onClick={dismissAdminOverlay}>
                <div className="form-modal-box glass-dark-effect admin-form-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
                  <FormModalCloseButton onClick={dismissAdminOverlay} />
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "10px", marginBottom: "15px", paddingRight: "44px" }}>
                    <h4>Customer Profile: {selectedCustomer.name}</h4>
                  </div>
                  <p><strong>Primary Contact Phone:</strong> {selectedCustomer.phone}</p>
                  <p><strong>Loyalty Coins Balance:</strong> <span className="font-gold">★ {selectedCustomer.coinsBalance} coins</span></p>
                  <p><strong>Aggregate Dining Orders:</strong> {selectedCustomer.ordersCount} placements</p>
                  <p><strong>Cumulative Spendings:</strong> ₹{formatPrice(selectedCustomer?.totalSpend)}</p>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "15px", marginTop: "15px" }}>
                    <h5 style={{ color: "#ffffff", fontSize: "13px", marginBottom: "10px" }}>Delivery & Address Profile</h5>
                    {editingCustomerFields ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div className="input-group">
                          <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Guest Name</label>
                          <input 
                            type="text" 
                            value={editingCustomerFields.name} 
                            onChange={(e) => setEditingCustomerFields({ ...editingCustomerFields, name: e.target.value })} 
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "8px", borderRadius: "4px", fontSize: "13px", width: "100%" }}
                          />
                        </div>
                        <div className="input-group">
                          <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Residence Address</label>
                          <textarea 
                            className="admin-fixed-textarea"
                            value={editingCustomerFields.address} 
                            onChange={(e) => setEditingCustomerFields({ ...editingCustomerFields, address: e.target.value })} 
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "4px", fontSize: "13px", width: "100%" }}
                          />
                          {editingCustomerFields.address && (
                            <AdminAddressMapBlock address={editingCustomerFields.address} compact />
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                          <button 
                            type="button"
                            className="btn-primary"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/user", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    phone: selectedCustomer.phone,
                                    customerName: editingCustomerFields.name,
                                    deliveryAddress: editingCustomerFields.address
                                  })
                                });
                                const resData = await parseJsonResponse(res);
                                if (resData.success) {
                                  setSelectedCustomer({
                                    ...selectedCustomer,
                                    name: editingCustomerFields.name,
                                    address: editingCustomerFields.address
                                  });
                                  setEditingCustomerFields(null);
                                  if (onRefreshData) onRefreshData(activeTab);
                                } else {
                                  alert("Failed to save: " + resData.error);
                                }
                              } catch (err) {
                                console.error(err);
                                alert("Failed to update profile.");
                              }
                            }}
                            style={{ fontSize: "12px", padding: "6px 12px", background: "#011E02", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "600", cursor: "pointer" }}
                          >
                            Save Profile
                          </button>
                          <button 
                            type="button" 
                            className="btn-secondary"
                            onClick={() => setEditingCustomerFields(null)}
                            style={{ fontSize: "12px", padding: "6px 12px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ color: "#ffffff" }}><strong>Full Name:</strong> {selectedCustomer.name}</p>
                        <p style={{ color: "#ffffff", marginTop: "8px" }}>
                          <strong>Permanent Home Address:</strong>
                        </p>
                        <div style={{ marginTop: "6px" }}>
                          <AdminAddressMapBlock address={selectedCustomer.address} />
                        </div>
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
                          ℹ️ This is the address saved in the user's profile — not a per-order address.
                        </p>
                        <button 
                          type="button"
                          className="btn-status-transition accepted"
                          onClick={() => setEditingCustomerFields({
                            phone: selectedCustomer.phone,
                            name: selectedCustomer.name,
                            address: selectedCustomer.address || ""
                          })}
                          style={{ marginTop: "10px", padding: "6px 12px", cursor: "pointer" }}
                        >
                          Edit Profile Details
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <h5 style={{ color: "#ffffff", fontSize: "13px", margin: "0 0 4px 0" }}>Order Logs History</h5>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", margin: "0 0 10px 0" }}>
                      Click any order to see full details including the delivery address used for that specific order.
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                    {activeOrders.filter(o => o.customerPhone === selectedCustomer.phone).map((ord) => (
                      <div 
                        key={ord.id} 
                        onClick={() => {
                          // Close customer modal first, then open order drawer
                          setSelectedCustomer(null);
                          setEditingCustomerFields(null);
                          setSelectedOrder(ord);
                        }}
                        style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          padding: "8px", 
                          background: "rgba(255,255,255,0.02)", 
                          borderRadius: "4px", 
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                        className="customer-order-log-item"
                        title="Click to view full order details"
                      >
                        <div>
                          <strong>{ord.id}</strong> ({ord.date})
                          <p style={{ margin: "3px 0 0 0", color: "rgba(255,255,255,0.5)" }}>{ord.items}</p>
                        </div>
                        <span style={{ fontWeight: "600" }}>₹{formatPrice(ord?.grandTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 10: PAYMENTS LOG
            ======================================================== */}
        {activeTab === "payments" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
              <h4>Payments Audit Trail</h4>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "250px" }}>
                  <Search size={14} className="text-muted" style={{ marginRight: "10px" }} />
                  <input 
                    type="text" 
                    placeholder="Search Payments..." 
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                  />
                </div>
                
                <AdminDateRangeFilter
                  value={sectionDateRanges.payments}
                  onChange={(next) => updateSectionDateRange("payments", next)}
                  onApply={(override) => applySectionDateRange("payments", override)}
                  isSyncing={isSyncing}
                />
              </div>
            </div>

            {filteredPaymentsList.length === 0 ? (
              renderEmptyState("No payments found matching the search / date")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Linked Order</th>
                      <th>Payer / Contact</th>
                      <th>Amount Authorized</th>
                      <th>Method</th>
                      <th>Payment Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaymentsList.map(pay => (
                      <tr key={pay.paymentId}>
                        <td><code>{pay.paymentId}</code></td>
                        <td><span className="font-gold">{pay.orderId}</span></td>
                        <td>
                          <strong>{pay.customerName || "Guest"}</strong>
                          <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)", marginTop: "2px" }}>
                            {pay.customerPhone || "N/A"}
                          </div>
                        </td>
                        <td>₹{formatPrice(pay?.amount)}</td>
                        <td>{pay.method}</td>
                        <td><span className={`status-pill ${pay.status === "Paid" ? "delivered" : "preparing"}`}>{pay.status}</span></td>
                        <td>{formatAdminDateTime(pay.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB: BUSINESS & STORE UPDATES CRUD
            ======================================================== */}
        {activeTab === "updates" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center" }}>
              <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "300px" }}>
                <Search size={14} className="text-muted" style={{ marginRight: "10px" }} />
                <input 
                  type="text" 
                  placeholder="Search Updates..." 
                  value={updateSearch}
                  onChange={(e) => setUpdateSearch(e.target.value)}
                  style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                />
              </div>
              <button className="btn-primary" onClick={() => setUpdateForm({ mode: "create", title: "", subtitle: "", content: "", tag: "New Store", image_url: "/masala_oats.png" })}>
                <Plus size={16} /> Add Update
              </button>
            </div>

            {filteredUpdatesList.length === 0 ? (
              renderEmptyState("No business updates found matching search query")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Tag</th>
                      <th>Title</th>
                      <th>Subtitle</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUpdatesList.map(upd => (
                      <tr key={upd.id}>
                        <td>
                          {upd.image_url ? (
                            <img src={upd.image_url} alt={upd.title} style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover" }} />
                          ) : (
                            <span className="text-muted">None</span>
                          )}
                        </td>
                        <td>
                          <span style={{ background: "rgba(201, 162, 39, 0.15)", border: "1px solid var(--accent-gold)", color: "var(--accent-gold)", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px", textTransform: "uppercase" }}>
                            {upd.tag}
                          </span>
                        </td>
                        <td><strong>{upd.title}</strong></td>
                        <td>{upd.subtitle || <span className="text-muted">—</span>}</td>
                        <td>
                          {new Date(upd.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button className="icon-action-btn edit" onClick={() => setUpdateForm({ mode: "edit", id: upd.id, ...upd })}>Edit</button>
                            <button className="icon-action-btn delete" onClick={() => handleUpdateDelete(upd.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB: POP-UP EVENTS CRUD
            ======================================================== */}
        {activeTab === "events" && (
          <div className="console-tab-pane">
            <div className="tab-actions-bar" style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", alignItems: "center" }}>
              <div className="search-box-wrapper" style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "5px 12px", width: "300px" }}>
                <Search size={14} className="text-muted" style={{ marginRight: "10px" }} />
                <input 
                  type="text" 
                  placeholder="Search Events..." 
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  style={{ border: "none", background: "transparent", color: "#fff", outline: "none", width: "100%", fontSize: "13px" }}
                />
              </div>
              <button className="btn-primary" onClick={() => setEventForm({ mode: "create", title: "", location: "", event_date: new Date().toISOString().slice(0, 16), description: "", requires_registration: false, image_url: "/south_indian_upma.png" })}>
                <Plus size={16} /> Add Event
              </button>
            </div>

            {filteredEventsList.length === 0 ? (
              renderEmptyState("No pop-up events found matching search query")
            ) : (
              <div className="table-responsive glass-effect" style={{ borderRadius: "8px" }}>
                <table className="console-custom-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Title</th>
                      <th>Location</th>
                      <th>Event Date</th>
                      <th>Registration Req.</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEventsList.map(evt => (
                      <tr key={evt.id}>
                        <td>
                          {evt.image_url ? (
                            <img src={evt.image_url} alt={evt.title} style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover" }} />
                          ) : (
                            <span className="text-muted">None</span>
                          )}
                        </td>
                        <td><strong>{evt.title}</strong></td>
                        <td>{evt.location}</td>
                        <td>{new Date(evt.event_date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td>
                          <span style={{ 
                            padding: "3px 8px", 
                            borderRadius: "10px", 
                            fontSize: "11px", 
                            fontWeight: "bold",
                            background: evt.requires_registration ? "rgba(201, 162, 39, 0.15)" : "rgba(1, 30, 2, 0.15)",
                            color: evt.requires_registration ? "var(--accent-gold)" : "#ffffff"
                          }}>
                            {evt.requires_registration ? "Required" : "Free Entry"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px" }}>
                            {evt.requires_registration && (
                              <button 
                                className="icon-action-btn edit" 
                                style={{ background: "rgba(201, 162, 39, 0.15)", color: "var(--accent-gold)", borderColor: "rgba(201, 162, 39, 0.3)" }}
                                onClick={() => handleViewRegistrations(evt.id, evt.title)}
                              >
                                View Guests
                              </button>
                            )}
                            <button className="icon-action-btn edit" onClick={() => setEventForm({ mode: "edit", id: evt.id, ...evt, event_date: new Date(evt.event_date).toISOString().slice(0, 16) })}>Edit</button>
                            <button className="icon-action-btn delete" onClick={() => handleEventDelete(evt.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 12.5: UPCOMING ITEMS
            ======================================================== */}
        {activeTab === "upcoming" && (
          <div className="console-tab-pane">
            <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="admin-title">Upcoming Items Preview</h3>
              <button className="btn-primary" onClick={() => { setUpcomingImageUploading(false); setUpcomingItemForm({ mode: "create", name: "", description: "", image: "" }); }}>
                <Plus size={16} /> Add Item
              </button>
            </div>
            <div className="admin-table-container glass-effect" style={{ background: 'transparent', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {upcomingItems.map((item) => (
                  <div key={item.id || item.name} className="glass-effect" style={{ borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(1, 30, 2, 0.6)' }}>
                    <img src={item.image} alt={item.name} style={{ width: '100%', height: '220px', objectFit: 'cover', borderBottom: '1px solid rgba(255,255,255,0.1)' }} />
                    <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '10px', fontFamily: "var(--font-poppins)" }}>{item.name}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '20px', flex: 1, lineHeight: '1.5' }}>{item.description}</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-secondary" style={{ flex: 1, borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => { setUpcomingImageUploading(false); setUpcomingItemForm({ mode: "edit", ...item }); }}>Edit</button>
                        <button className="btn-secondary" style={{ flex: 1, color: '#ff4d4f', borderColor: 'rgba(255, 77, 79, 0.4)' }} onClick={() => handleUpcomingItemDelete(item.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {upcomingItems.length === 0 && (
                <div style={{ color: '#fff', padding: '40px', textAlign: 'center', width: '100%', background: 'rgba(1, 30, 2, 0.4)', borderRadius: '16px' }}>
                  No upcoming items found. Click "Add Item" to create one.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 12.75: CONTACT SUBMISSIONS (GUEST INQUIRIES)
            ======================================================== */}
        {activeTab === "contacts" && (
          <div className="console-tab-pane">
            <div className="tab-header" style={{ marginBottom: '20px' }}>
              <h3 className="admin-title" style={{ fontFamily: "var(--font-poppins)", fontSize: '2rem', color: '#fff', margin: 0 }}>Guest Inquiries</h3>
            </div>
            <div className="admin-table-container glass-effect" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(15, 30, 20, 0.4)' }}>
              {contacts && contacts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {contacts.map((c) => (
                    <div key={c.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '10px' }}>
                        <div>
                          <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{c.name}</strong>
                          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                            {c.email && <span style={{ marginRight: '15px' }}>📧 {c.email}</span>}
                            {c.phone && <span>📞 {c.phone}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            className="icon-action-btn delete"
                            onClick={() => handleContactDelete(c.id)}
                            disabled={isActionLoading(`contact-delete-${c.id}`)}
                            title="Remove inquiry"
                            aria-label="Remove inquiry"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {c.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.5)', padding: '40px', textAlign: 'center' }}>
                  No guest inquiries submitted yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 13: CONSOLE SETTINGS
            ======================================================== */}
        {activeTab === "settings" && (
          <div className="console-tab-pane">
            <form onSubmit={handleSettingsSubmit} className="glass-effect" style={{ padding: "30px", borderRadius: "8px", maxWidth: "800px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px", marginBottom: "24px" }}>
                <h4 style={{ margin: 0 }}>Operational Settings parameters</h4>
                <LoadingButton type="submit" className="btn-primary" style={{ padding: "10px 20px", whiteSpace: "nowrap" }} loading={isActionLoading("settings-submit")} loadingText="Saving…">
                  Save Console Configurations
                </LoadingButton>
              </div>

              <h5 style={{ margin: "0 0 15px 0", color: "#ffffff", fontSize: "14px" }}>Hero Section Video</h5>
              <div className="input-group" style={{ marginBottom: "24px" }}>
                <label>Hero Background Video URL</label>
                <input
                  type="url"
                  value={settingsState.hero_video_url ?? DEFAULT_HERO_VIDEO_URL}
                  onChange={(e) => updateSettingsField("hero_video_url", e.target.value)}
                  placeholder="https://res.cloudinary.com/.../video.mp4"
                  required
                />
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "8px", lineHeight: 1.5 }}>
                  Paste any direct MP4 video link (Cloudinary or other host). This video plays in the homepage hero section.
                </p>
              </div>

              <h5 style={{ margin: "0 0 15px 0", color: "#ffffff", fontSize: "14px" }}>Hero Background Music</h5>
              <div className="input-group" style={{ marginBottom: "24px" }}>
                <label>Hero Background Audio URL</label>
                <input
                  type="url"
                  value={settingsState.hero_audio_url ?? ""}
                  onChange={(e) => updateSettingsField("hero_audio_url", e.target.value)}
                  placeholder="https://res.cloudinary.com/.../music.mp3"
                />
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginTop: "8px", lineHeight: 1.5 }}>
                  Paste a direct MP3 or audio link. Saved to the settings database when you submit this form. Visitors can mute or unmute from the navbar.
                </p>
              </div>
              
              <div className="form-row-three" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div className="input-group">
                  <label>Restaurant Name</label>
                  <input type="text" value={settingsState.restaurant_name} onChange={(e) => updateSettingsField("restaurant_name", e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Phone Desk</label>
                  <input type="text" value={settingsState.restaurant_phone} onChange={(e) => updateSettingsField("restaurant_phone", e.target.value)} required />
                </div>
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div className="input-group">
                  <label>Email Desk</label>
                  <input type="email" value={settingsState.restaurant_email} onChange={(e) => updateSettingsField("restaurant_email", e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Miyashita Address</label>
                  <input type="text" value={settingsState.restaurant_address} onChange={(e) => updateSettingsField("restaurant_address", e.target.value)} required />
                </div>
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px", marginBottom: "20px" }}>
                <div className="input-group">
                  <label>Main Location Map Link</label>
                  <input
                    type="url"
                    value={settingsState.restaurant_map_link}
                    onChange={(e) => updateSettingsField("restaurant_map_link", e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Main Location Map Embed URL</label>
                  <input
                    type="url"
                    value={settingsState.restaurant_map_embed}
                    onChange={(e) => updateSettingsField("restaurant_map_embed", e.target.value)}
                    placeholder="https://www.google.com/maps/embed?pb=..."
                    required
                  />
                </div>
              </div>

              <h5 style={{ margin: "25px 0 15px 0", color: "#ffffff", fontSize: "14px" }}>Logistics fees & Taxation (INR)</h5>
              <div className="form-row-four" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div className="input-group">
                  <label>Packing Fee (₹)</label>
                  <input type="text" inputMode="decimal" className="decimal-input" value={settingsState.packing_charge} onChange={(e) => updateSettingsField("packing_charge", sanitizeDecimalInput(e.target.value))} required />
                </div>
                <div className="input-group">
                  <label>Service Tax / GST (%)</label>
                  <input type="text" inputMode="decimal" className="decimal-input" value={settingsState.gst_percent} onChange={(e) => updateSettingsField("gst_percent", sanitizeDecimalInput(e.target.value))} required />
                </div>
              </div>

              <h5 style={{ margin: "25px 0 15px 0", color: "#ffffff", fontSize: "14px" }}>Delivery Distance Pricing (INR)</h5>
              <div className="form-row-four" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div className="input-group">
                  <label>Base Distance (km)</label>
                  <input type="text" inputMode="decimal" className="decimal-input" value={settingsState.delivery_base_km} onChange={(e) => updateSettingsField("delivery_base_km", sanitizeDecimalInput(e.target.value))} required />
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>Flat fee applies up to this distance</p>
                </div>
                <div className="input-group">
                  <label>Base Delivery Fee (₹)</label>
                  <input type="text" inputMode="decimal" className="decimal-input" value={settingsState.delivery_base_fee} onChange={(e) => updateSettingsField("delivery_base_fee", sanitizeDecimalInput(e.target.value))} required />
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>Fee for deliveries within base km</p>
                </div>
                <div className="input-group">
                  <label>Extra Price per km (₹)</label>
                  <input type="text" inputMode="decimal" className="decimal-input" value={settingsState.delivery_extra_km_price} onChange={(e) => updateSettingsField("delivery_extra_km_price", sanitizeDecimalInput(e.target.value))} required />
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>Added for each km beyond base distance</p>
                </div>
                <div className="input-group">
                  <label>Max Delivery Radius (km)</label>
                  <input type="text" inputMode="decimal" className="decimal-input" value={settingsState.delivery_max_km} onChange={(e) => updateSettingsField("delivery_max_km", sanitizeDecimalInput(e.target.value))} required />
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}>Orders beyond this distance are blocked</p>
                </div>
              </div>

            </form>
          </div>
        )}

        {/* ========================================================
            TAB: TIME SLOTS
            ======================================================== */}
        {activeTab === "time-slots" && (
          <div className="console-tab-pane">
            <div className="glass-effect" style={{ padding: "30px", borderRadius: "8px", maxWidth: "800px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "16px", marginBottom: "24px" }}>
                <div>
                  <h4 style={{ margin: 0 }}>Delivery / Pickup Time Slots</h4>
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>
                    Manage restaurant hours, default slots, and date-specific availability.
                  </p>
                </div>
                <LoadingButton
                  type="button"
                  className="btn-primary"
                  style={{ padding: "10px 20px", whiteSpace: "nowrap" }}
                  loading={isActionLoading("time-slots-defaults-save")}
                  loadingText="Saving…"
                  onClick={saveTimeSlotDefaults}
                >
                  Save Timings & Defaults
                </LoadingButton>
              </div>

              <h5 style={{ margin: "0 0 15px 0", color: "#ffffff", fontSize: "14px" }}>Restaurant Timings</h5>
              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "12px" }}>
                <div className="input-group">
                  <label>Opening hour (Open)</label>
                  <input type="time" value={settingsState.open_time} onChange={(e) => handleRestaurantTimingChange("open_time", e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Closing hour (Close)</label>
                  <input type="time" value={settingsState.close_time} onChange={(e) => handleRestaurantTimingChange("close_time", e.target.value)} required />
                </div>
              </div>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", margin: "0 0 20px 0" }}>
                Delivery and pickup slots are generated automatically in 1-hour intervals from opening to closing time.
              </p>

              <h5 style={{ margin: "25px 0 15px 0", color: "#ffffff", fontSize: "14px" }}>Default Time Slots (all dates)</h5>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", margin: "0 0 12px 0" }}>
                These are the defaults for every day. Use the date-specific section below to enable or disable slots for a single date or a custom date range.
              </p>
              <div style={{ marginBottom: "20px" }}>
                {configuredTimeSlots.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>No time slots configured.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    {configuredTimeSlots.map((slot, index) => (
                      <div
                        key={`${slot.label}-${slot.startHour}-${index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: slot.enabled !== false ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                          border: slot.enabled !== false ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.04)",
                          opacity: slot.enabled !== false ? 1 : 0.65
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ color: "#fff", fontSize: "13px" }}>{slot.label}</span>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                            {slot.enabled !== false ? "Default: visible to customers" : "Default: hidden from customers"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <select
                            value={slot.enabled !== false ? "enabled" : "disabled"}
                            onChange={(e) => setDeliveryTimeSlotEnabled(index, e.target.value === "enabled")}
                            style={getStatusSelectStyle(slot.enabled !== false)}
                          >
                            <option value="enabled" style={{ background: "#1B5E20", color: "#fff" }}>Enabled</option>
                            <option value="disabled" style={{ background: "#B71C1C", color: "#fff" }}>Disabled</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <h5 style={{ margin: "25px 0 15px 0", color: "#ffffff", fontSize: "14px" }}>
                Date-Specific Time Slots
              </h5>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", margin: "0 0 12px 0" }}>
                Pick a specific date or a custom range, then enable/disable slots for those days only. Customers only see the slots enabled for their selected date. Date rules save to the database immediately.
              </p>

              <div
                style={{
                  marginBottom: "20px",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)"
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      opacity: slotDateRuleDraft.mode === "single" ? 1 : 0.7,
                      borderColor: slotDateRuleDraft.mode === "single" ? "#43A047" : undefined
                    }}
                    onClick={() =>
                      refreshSlotDateDraftSlots(slotDateRuleDraft.from || formatLocalDateYmd(), "single")
                    }
                  >
                    Specific date
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      opacity: slotDateRuleDraft.mode === "range" ? 1 : 0.7,
                      borderColor: slotDateRuleDraft.mode === "range" ? "#43A047" : undefined
                    }}
                    onClick={() =>
                      refreshSlotDateDraftSlots(
                        slotDateRuleDraft.from || formatLocalDateYmd(),
                        "range",
                        slotDateRuleDraft.to || slotDateRuleDraft.from || formatLocalDateYmd()
                      )
                    }
                  >
                    Custom date range
                  </button>
                </div>

                <div
                  className="form-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: slotDateRuleDraft.mode === "range" ? "1fr 1fr" : "1fr",
                    gap: "16px",
                    marginBottom: "14px"
                  }}
                >
                  <div className="input-group">
                    <label>{slotDateRuleDraft.mode === "range" ? "From date" : "Date"}</label>
                    <input
                      type="date"
                      value={slotDateRuleDraft.from}
                      onChange={(e) => {
                        const nextFrom = e.target.value;
                        refreshSlotDateDraftSlots(
                          nextFrom,
                          slotDateRuleDraft.mode,
                          slotDateRuleDraft.mode === "single" ? nextFrom : slotDateRuleDraft.to
                        );
                      }}
                    />
                  </div>
                  {slotDateRuleDraft.mode === "range" && (
                    <div className="input-group">
                      <label>To date</label>
                      <input
                        type="date"
                        value={slotDateRuleDraft.to}
                        min={slotDateRuleDraft.from || undefined}
                        onChange={(e) =>
                          setSlotDateRuleDraft((prev) => ({ ...prev, to: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>

                {slotDateRuleDraft.slots.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>
                    No time slots available for these timings.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                    {slotDateRuleDraft.slots.map((slot) => (
                      <div
                        key={`date-slot-${slot.startHour}-${slot.label}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: slot.enabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                          border: slot.enabled ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.04)",
                          opacity: slot.enabled ? 1 : 0.65
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ color: "#fff", fontSize: "13px" }}>{slot.label}</span>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                            {slot.enabled ? "Visible on selected date(s)" : "Hidden on selected date(s)"}
                          </span>
                        </div>
                        <select
                          value={slot.enabled ? "enabled" : "disabled"}
                          onChange={(e) =>
                            setDateRuleDraftSlotEnabled(slot.startHour, e.target.value === "enabled")
                          }
                          style={getStatusSelectStyle(slot.enabled)}
                        >
                          <option value="enabled" style={{ background: "#1B5E20", color: "#fff" }}>Enabled</option>
                          <option value="disabled" style={{ background: "#B71C1C", color: "#fff" }}>Disabled</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <LoadingButton
                  type="button"
                  className="btn-primary"
                  loading={isActionLoading("date-slot-rules-save")}
                  loadingText="Saving…"
                  onClick={saveDateSlotRule}
                >
                  {slotDateRuleDraft.editingId ? "Update date slot rule" : "Save date slot rule"}
                </LoadingButton>
              </div>

              <div style={{ marginBottom: "8px" }}>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", marginBottom: "10px" }}>
                  Saved date rules ({configuredDateSlotRules.length})
                </p>
                {configuredDateSlotRules.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
                    No date-specific rules yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {configuredDateSlotRules.map((rule) => {
                      const enabledCount = (rule.slots || []).filter((s) => s.enabled !== false).length;
                      const disabledCount = (rule.slots || []).length - enabledCount;
                      return (
                        <div
                          key={rule.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)"
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span style={{ color: "#fff", fontSize: "13px" }}>
                              {formatSlotRuleDateLabel(rule)}
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                              {enabledCount} enabled · {disabledCount} disabled
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => loadDateSlotRuleIntoDraft(rule)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => removeDateSlotRule(rule.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* ========================================================
          GLOBAL ORDER DETAILS DRAWER — available from any tab
          ======================================================== */}
      {selectedOrder && (
        <div className="details-overlay-backdrop" style={{ zIndex: 2000 }} onClick={dismissAdminOverlay}>
          <div className="details-drawer glass-dark-effect" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>Order Details</h4>
              <button className="btn-close" onClick={dismissAdminOverlay}>×</button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">
                <span className="section-label">ORDER METADATA</span>
                <p><strong>Order ID:</strong> {selectedOrder.displayOrderId || formatOrderNumber(selectedOrder.orderNumber) || selectedOrder.id}</p>
                <p><strong>Created At:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                <p className="drawer-status-row">
                  <strong>Status:</strong>
                  {renderOrderStatusControl(selectedOrder)}
                </p>
                {!isOrderCancelled(selectedOrder.status) ? (
                  <button
                    type="button"
                    className="order-cancel-drawer-btn"
                    disabled={isActionLoading(`order-status-${selectedOrder.id}`)}
                    onClick={() => markOrderCancelled(selectedOrder)}
                  >
                    Cancel Order
                  </button>
                ) : (
                  <button
                    type="button"
                    className="order-undo-drawer-btn admin-surface-light"
                    disabled={isActionLoading(`order-status-${selectedOrder.id}`)}
                    onClick={() => undoCancelledOrder(selectedOrder)}
                  >
                    Undo to Pending
                  </button>
                )}
              </div>

              <div className="drawer-section">
                <span className="section-label">GUEST DETAILS</span>
                <p><strong>Billing Name:</strong> {selectedOrder.customerName}</p>
                <p><strong>Customer Phone:</strong> {selectedOrder.customerPhone}</p>
                <p><strong>Receiver Name:</strong> {selectedOrder.receiverName}</p>
                <p><strong>Receiver Phone:</strong> {selectedOrder.receiverPhone}</p>
              </div>

              <div className="drawer-section">
                <span className="section-label">DELIVERY LOGISTICS</span>
                {selectedOrder.location && (selectedOrder.location.toLowerCase().includes("takeaway") || selectedOrder.location.toLowerCase().includes("pickup")) ? (
                  <>
                    <p>
                      <strong>Order Type:</strong>{" "}
                      <span style={{ 
                        display: "inline-block", background: "rgba(1, 30, 2,0.2)", 
                        color: "#ffffff", border: "1px solid rgba(255,255,255,0.25)",
                        borderRadius: "4px", padding: "2px 8px", fontSize: "12px", fontWeight: 700
                      }}>
                        🏪 Takeaway / Self Pickup
                      </span>
                    </p>
                    {(() => {
                      const preferredPickup =
                        selectedOrder.preferredPickupTime ||
                        selectedOrder.tableNo ||
                        parsePickupTable(selectedOrder.location);
                      return preferredPickup ? (
                        <p style={{ marginTop: "8px" }}>
                          <strong>Preferred Pickup Time:</strong> {preferredPickup}
                        </p>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <>
                    <div>
                      <strong style={{ color: "#ffffff" }}>Delivery Address:</strong>
                      <div style={{ marginTop: "6px" }}>
                        <AdminAddressMapBlock address={selectedOrder.location || "Not specified"} />
                      </div>
                    </div>
                    {selectedOrder.landmark && <p><strong>Landmark:</strong> {selectedOrder.landmark}</p>}
                    <p><strong>Pincode:</strong> {selectedOrder.pincode}</p>
                  </>
                )}
                {(() => {
                  const isTakeawayOrder =
                    selectedOrder.location &&
                    (selectedOrder.location.toLowerCase().includes("takeaway") ||
                      selectedOrder.location.toLowerCase().includes("pickup"));
                  const scheduled =
                    selectedOrder.deliveryDateTime ||
                    parseScheduleFromInstructions(selectedOrder.specialInstructions);
                  const additionalRequests = parseAdditionalRequests(
                    selectedOrder.specialInstructions
                  );
                  return (
                    <>
                      {scheduled && (
                        <p style={{ marginTop: "8px" }}>
                          <strong>{isTakeawayOrder ? "Scheduled Pickup:" : "Scheduled:"}</strong>{" "}
                          {scheduled}
                        </p>
                      )}
                      {additionalRequests && (
                        <div className="special-notes-box">
                          <strong>Additional Requests:</strong>
                          <p>{additionalRequests}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="drawer-section">
                <span className="section-label">SELECTIONS SUMMARY</span>
                <div className="drawer-items-list">
                  {selectedOrder.itemsList?.map((item, idx) => (
                    <div key={idx} className="drawer-item-row">
                      <div className="item-left">
                        <div className="admin-order-item-title">
                          <strong>{item.quantity}x</strong>
                          <span>{getItemBaseName(item)}</span>
                          <ItemSizeBadge item={item} className="admin-item-size-badge" />
                        </div>
                        {item.selected_addons && item.selected_addons.length > 0 && (
                          <p className="addons-sub">+ {item.selected_addons.map(a=>a.name).join(", ")}</p>
                        )}
                      </div>
                      <span className="item-price">₹{formatPrice((item?.price || 0) * (item?.quantity || 1))}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const details = buildOrderEnjoyDetails(selectedOrder, settingsState || settings);
                const isTakeaway = details.diningMode === "takeaway" || 
                  (selectedOrder?.location && (selectedOrder.location.toLowerCase().includes("takeaway") || selectedOrder.location.toLowerCase().includes("pickup")));

                return (
                  <div className="drawer-section billing-summary">
                    <div className="bill-row"><span>Subtotal</span><span>₹{formatPrice(details.subtotal)}</span></div>
                    {details.coinDiscount > 0 && <div className="bill-row saving"><span>Coins Redeemed</span><span>-₹{formatPrice(details.coinDiscount)}</span></div>}
                    {details.promoDiscount > 0 && <div className="bill-row saving"><span>Promo Deduction{details.promoCode ? ` (${details.promoCode})` : ""}</span><span>-₹{formatPrice(details.promoDiscount)}</span></div>}
                    <div className="bill-row">
                      <span>
                        Service Tax / GST
                        {details.gstPercent != null && Number.isFinite(parseFloat(details.gstPercent)) ? ` (${parseFloat(details.gstPercent)}%)` : ""}
                      </span>
                      <span>₹{formatPrice(details.tax)}</span>
                    </div>
                    <div className="bill-row">
                      <span>Packing Fee</span>
                      <span>₹{formatPrice(details.packingFee)}</span>
                    </div>
                    {(!isTakeaway || details.deliveryFee > 0) && (
                      <div className="bill-row">
                        <span>
                          Delivery Fee
                          {details.distanceKm != null ? ` (${details.distanceKm} km)` : ""}
                        </span>
                        <span>₹{formatPrice(details.deliveryFee)}</span>
                      </div>
                    )}
                    <div className="divider"></div>
                    <div className="bill-row total"><span>Grand Total Bill</span><span className="font-gold">₹{formatPrice(details.grandTotal)}</span></div>
                    <div className="bill-row coins-earned"><span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>★ Earned {details.coinsEarned} Reserve coins</span></div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* UPDATE MODAL FORM */}
      {updateForm && (
        <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
          <div className="form-modal-box admin-form-modal glass-dark-effect" onClick={(e) => e.stopPropagation()} style={{ background: "rgba(10, 15, 12, 0.95)", border: "1px solid rgba(212, 175, 55, 0.2)", backdropFilter: "blur(20px)" }}>
            <FormModalCloseButton onClick={dismissAdminOverlay} />
            <h4 style={{ fontFamily: "var(--font-poppins)" }}>{updateForm.mode === "create" ? "Create Brand Announcement" : "Modify Brand Announcement"}</h4>
            <form onSubmit={handleUpdateSubmit}>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Announcement Title</label>
                <input 
                  type="text" 
                  value={updateForm.title} 
                  onChange={(e) => setUpdateForm({...updateForm, title: e.target.value})} 
                  placeholder="e.g. Jubilee Hills Gym Store Opening"
                  required 
                />
              </div>

              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Sub-heading / Short Hook</label>
                <input 
                  type="text" 
                  value={updateForm.subtitle} 
                  onChange={(e) => setUpdateForm({...updateForm, subtitle: e.target.value})} 
                  placeholder="e.g. Fuel your workouts with premium healthy nutrition."
                />
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div className="input-group">
                  <label>Update Tag / Category</label>
                  <select 
                    value={updateForm.tag} 
                    onChange={(e) => setUpdateForm({...updateForm, tag: e.target.value})}
                    required
                  >
                    <option value="New Store">New Store</option>
                    <option value="Gym Opening">Gym Opening</option>
                    <option value="Mall Opening">Mall Opening</option>
                    <option value="Business Update">Business Update</option>
                    <option value="Event">Event</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Promo Image (URL)</label>
                  <input 
                    type="text" 
                    value={updateForm.image_url} 
                    onChange={(e) => setUpdateForm({...updateForm, image_url: e.target.value})} 
                    placeholder="e.g. /masala_oats.png"
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Detailed Announcement content</label>
                <textarea 
                  rows="4" 
                  value={updateForm.content} 
                  onChange={(e) => setUpdateForm({...updateForm, content: e.target.value})} 
                  placeholder="Write the detailed update or announcement body text here..."
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={dismissAdminOverlay}>Cancel</button>
                <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("update-submit")} loadingText="Saving…">{updateForm.mode === "create" ? "Save Announcement" : "Save Changes"}</LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT MODAL FORM */}
      {eventForm && (
        <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
          <div className="form-modal-box admin-form-modal glass-dark-effect" onClick={(e) => e.stopPropagation()} style={{ background: "rgba(10, 15, 12, 0.95)", border: "1px solid rgba(212, 175, 55, 0.2)", backdropFilter: "blur(20px)" }}>
            <FormModalCloseButton onClick={dismissAdminOverlay} />
            <h4 style={{ fontFamily: "var(--font-poppins)" }}>{eventForm.mode === "create" ? "Create Pop-up Event" : "Modify Pop-up Event"}</h4>
            <form onSubmit={handleEventSubmit}>
              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Event Title</label>
                <input 
                  type="text" 
                  value={eventForm.title} 
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})} 
                  placeholder="e.g. Startup Expo Kitchen Pop-up"
                  required 
                />
              </div>

              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Event Location</label>
                <input 
                  type="text" 
                  value={eventForm.location} 
                  onChange={(e) => setEventForm({...eventForm, location: e.target.value})} 
                  placeholder="e.g. T-Hub Pop-up #12, Gachibowli"
                  required
                />
              </div>

              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div className="input-group">
                  <label>Event Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={eventForm.event_date} 
                    onChange={(e) => setEventForm({...eventForm, event_date: e.target.value})}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Promo Image (URL)</label>
                  <input 
                    type="text" 
                    value={eventForm.image_url} 
                    onChange={(e) => setEventForm({...eventForm, image_url: e.target.value})} 
                    placeholder="e.g. /south_indian_upma.png"
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: "15px", flexDirection: "row", alignItems: "center", gap: "10px" }}>
                <input 
                  type="checkbox" 
                  id="requires_registration"
                  checked={eventForm.requires_registration} 
                  onChange={(e) => setEventForm({...eventForm, requires_registration: e.target.checked})}
                  style={{ width: "auto", cursor: "pointer" }}
                />
                <label htmlFor="requires_registration" style={{ minHeight: "auto", cursor: "pointer", color: "#fff", margin: 0 }}>Requires Guest Registration</label>
              </div>

              <div className="input-group" style={{ marginBottom: "15px" }}>
                <label>Event Description</label>
                <textarea 
                  rows="4" 
                  value={eventForm.description} 
                  onChange={(e) => setEventForm({...eventForm, description: e.target.value})} 
                  placeholder="Write details about the pop-up, registration benefits, startup hubs, free tastings..."
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={dismissAdminOverlay}>Cancel</button>
                <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("event-submit")} loadingText="Saving…">{eventForm.mode === "create" ? "Save Event" : "Save Changes"}</LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPCOMING ITEM FORM */}
      {upcomingItemForm && (
        <div className="details-overlay-backdrop form-modal-overlay" onClick={dismissAdminOverlay}>
          <div className="form-modal-box admin-form-modal glass-dark-effect" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", width: "100%" }}>
            <FormModalCloseButton onClick={dismissAdminOverlay} />
            <h3 className="admin-title" style={{ marginBottom: "25px", paddingRight: "44px" }}>{upcomingItemForm.mode === "create" ? "Add Upcoming Item" : "Edit Upcoming Item"}</h3>
            <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <form onSubmit={handleUpcomingItemSubmit} style={{ flex: '1 1 100%' }}>
                <div className="input-group" style={{ marginBottom: "20px" }}>
                  <label>Item Name</label>
                  <input 
                    type="text" 
                    value={upcomingItemForm.name} 
                    onChange={(e) => setUpcomingItemForm({...upcomingItemForm, name: e.target.value})} 
                    required
                  />
                </div>

                <ProductImageUpload
                  label="Item Image"
                  inputId="upcoming-item-image-file-input"
                  imageUrl={upcomingItemForm.image || ""}
                  onImageUrlChange={(url) => setUpcomingItemForm({ ...upcomingItemForm, image: url })}
                  onUploadingChange={setUpcomingImageUploading}
                />

                <div className="input-group" style={{ marginBottom: "25px" }}>
                  <label>Description</label>
                  <textarea 
                    rows="4" 
                    value={upcomingItemForm.description} 
                    onChange={(e) => setUpcomingItemForm({...upcomingItemForm, description: e.target.value})} 
                    required
                  />
                </div>

                <div className="form-actions" style={{ justifyContent: 'flex-start', gap: '15px' }}>
                  <LoadingButton type="submit" className="btn-primary" loading={isActionLoading("upcoming-submit") || upcomingImageUploading} loadingText={upcomingImageUploading ? "Uploading Image…" : "Saving…"}>{upcomingItemForm.mode === "create" ? "Save Item" : "Save Changes"}</LoadingButton>
                  <button type="button" className="btn-secondary" onClick={dismissAdminOverlay}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW REGISTERED GUESTS DRAWER/MODAL */}
      {selectedEventRegs && (
        <div className="details-overlay-backdrop" style={{ zIndex: 2000 }} onClick={dismissAdminOverlay}>
          <div className="details-drawer glass-dark-effect" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h4 style={{ color: "var(--accent-gold)", fontSize: "16px", margin: "0" }}>Registered Guests</h4>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", margin: "4px 0 0 0" }}>{selectedEventRegs.eventTitle}</p>
              </div>
              <button className="btn-close" onClick={dismissAdminOverlay}>×</button>
            </div>
            <div className="drawer-body">
              {selectedEventRegs.list.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.4)" }}>
                  No guest registrations recorded for this event yet.
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: "calc(100vh - 120px)" }}>
                  <table className="console-custom-table" style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>Guest Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Registered At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEventRegs.list.map(reg => (
                        <tr key={reg.id}>
                          <td><strong>{reg.user_name}</strong></td>
                          <td>{reg.user_phone}</td>
                          <td>{reg.user_email || <span className="text-muted">—</span>}</td>
                          <td>{new Date(reg.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {appAlert && (
        <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-content glass-effect" style={{ maxWidth: '400px', width: '90%', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', background: 'rgba(15,30,20,0.95)' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px', fontFamily: "var(--font-poppins)" }}>Notification</h3>
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

      {appConfirm && (
        <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-content glass-effect" style={{ maxWidth: '400px', width: '90%', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', background: 'rgba(15,30,20,0.95)' }}>
            <h3 style={{ color: '#fff', marginBottom: '15px', fontFamily: "var(--font-poppins)" }}>Confirmation</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', marginBottom: '25px', lineHeight: '1.5' }}>
              {appConfirm.message}
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  const cb = appConfirm.onConfirm;
                  setAppConfirm(null);
                  if (cb) cb();
                }} 
                className="btn-primary"
                style={{ padding: '8px 25px', borderRadius: '8px', border: 'none', background: 'var(--accent-gold)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
              >
                Confirm
              </button>
              <button 
                onClick={() => setAppConfirm(null)} 
                className="btn-secondary"
                style={{ padding: '8px 25px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(body) {
          background-color: #0A0B09 !important;
        }
        .admin-console-layout h1,
        .admin-console-layout h2,
        .admin-console-layout h3,
        .admin-console-layout h4,
        .admin-console-layout h5,
        .admin-console-layout h6,
        .admin-console-layout p,
        .admin-console-layout span,
        .admin-console-layout td,
        .admin-console-layout th,
        .admin-console-layout label,
        .admin-console-layout strong,
        .admin-console-layout .form-modal-box p,
        .admin-console-layout .form-modal-box strong,
        .admin-console-layout .drawer-section p,
        .admin-console-layout .drawer-section strong,
        .admin-console-layout .metric-panel .value,
        .admin-console-layout .chart-card h4 {
          color: #ffffff !important;
        }
        /* White/light surfaces — black text & icons */
        .admin-console-layout .admin-surface-light,
        .admin-console-layout .sidebar-tab-btn.active,
        .admin-console-layout .sidebar-tab-btn.active span,
        .admin-console-layout .filter-tab-btn.active,
        .admin-console-layout .order-status-toggle.is-completed,
        .admin-console-layout .order-status-toggle.is-undo-pending,
        .admin-console-layout .icon-action-btn.order-undo-btn {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
        .admin-console-layout .sidebar-tab-btn.active svg,
        .admin-console-layout .order-status-toggle.is-completed svg,
        .admin-console-layout .order-status-toggle.is-undo-pending svg {
          color: #000000 !important;
          stroke: #000000 !important;
        }
        .admin-console-layout .admin-surface-light {
          background: #ffffff !important;
        }
        .console-custom-table th {
          color: #ffffff !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
        }
        .admin-console-layout :global(.glass-effect) {
          background: rgba(10, 15, 12, 0.7) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(1, 30, 2, 0.15) !important;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4) !important;
        }
        /* ===== Hide all scrollbars across admin panel ===== */
        .admin-console-layout *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .admin-console-layout * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .sidebar-toggle-trigger {
          display: none !important;
        }
        /* ===== Compact button overrides ===== */
        .admin-console-layout :global(.btn-primary),
        .admin-console-layout :global(button.btn-primary) {
          padding: 6px 12px !important;
          font-size: 11px !important;
          height: auto !important;
          line-height: normal !important;
          margin: 4px 0 !important;
          background-color: #0F4D2F !important;
          border: 1.5px solid #0F4D2F !important;
          color: #ffffff !important;
          box-shadow: none !important;
          transition: all 0.2s ease !important;
        }
        .admin-console-layout :global(.btn-primary:hover),
        .admin-console-layout :global(button.btn-primary:hover) {
          background-color: #011E02 !important;
          border-color: #011E02 !important;
          color: #ffffff !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .admin-console-layout :global(.btn-secondary),
        .admin-console-layout :global(button.btn-secondary) {
          padding: 8px 18px !important;
          font-size: 12px !important;
          height: auto !important;
          line-height: normal !important;
          margin: 4px 0 !important;
          background: transparent !important;
          border: 1.5px solid rgba(255, 255, 255, 0.3) !important;
          color: rgba(255, 255, 255, 0.8) !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          font-family: var(--font-poppins)'Inter', sans-serif !important;
          letter-spacing: 0.3px !important;
        }
        .admin-console-layout :global(.btn-secondary:hover),
        .admin-console-layout :global(button.btn-secondary:hover) {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
          color: #ffffff !important;
        }
        .admin-console-layout {
          display: flex;
          min-height: 100vh;
          background: #0A0B09;
          color: #fff;
          font-family: var(--font-poppins)'Inter', sans-serif;
        }
        .console-sidebar {
          width: 260px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          background: rgba(10, 11, 9, 0.7);
        }
        .sidebar-brand {
          padding: 25px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-nav-links {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 15px 10px;
          gap: 4px;
        }
        .sidebar-tab-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.7);
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          text-align: left;
          transition: all 0.2s;
        }
        .sidebar-tab-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.03);
        }
        .sidebar-tab-btn.active {
          color: #000000 !important;
          background: #ffffff;
          font-weight: 600;
        }
        .sidebar-footer {
          padding: 15px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .logout-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .console-main-content {
          flex: 1;
          padding: 30px;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .table-responsive {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin-bottom: 20px;
        }
        /* Tab header bar — button spacing */
        .tab-actions-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 12px;
        }
        .tab-actions-bar h4 {
          margin: 0;
          flex: 1;
        }
        .console-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          gap: 16px;
        }
        .header-actions {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .header-subtitle-tag {
          font-size: 10px;
          color: #ffffff;
          font-weight: 700;
          letter-spacing: 2px;
        }
        .header-title {
          font-family: var(--font-poppins)"Playfair Display", serif;
          font-size: 24px;
          margin-top: 2px;
          color: #fff;
          line-height: 1.2;
          font-weight: 600;
        }
        .analytics-overview-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 15px;
          margin-bottom: 35px;
        }
        .metric-panel {
          padding: 20px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .metric-panel .label {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 5px;
        }
        .metric-panel .value {
          font-size: 22px;
          font-weight: 700;
          font-family: var(--font-poppins)'Poppins', 'Inter', sans-serif;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
        .item-price,
        .billing-summary .bill-row span:last-child {
          font-family: var(--font-poppins)'Poppins', 'Inter', sans-serif !important;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
        .font-gold { color: #d4af37 !important; }
        .font-green { color: #ffffff !important; }
        .font-red { color: rgba(255, 255, 255, 0.6); }
        .dashboard-charts-grid {
          display: grid;
          grid-template-columns: 1.3fr 0.7fr;
          gap: 25px;
        }
        .chart-card {
          padding: 25px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .chart-card h4 {
          font-family: var(--font-poppins)"Playfair Display", serif;
          font-size: 18px;
          margin-bottom: 4px;
        }
        .chart-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }
        .console-custom-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .console-custom-table th {
          padding: 12px 15px;
          font-size: 11px;
          color: #ffffff !important;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        }
        .console-custom-table td {
          padding: 12px 15px;
          font-size: 13px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #ffffff !important;
        }
        .status-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-pill.preparing { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.7); }
        .status-pill.delivering { background: rgba(255, 255, 255, 0.12); color: #ffffff; }
        .status-pill.delivered { background: rgba(255, 255, 255, 0.12); color: #ffffff; }
        .status-pill.accepted { background: rgba(255, 255, 255, 0.12); color: #ffffff; }
        .status-pill.cancelled { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.4); }

        /* Premium scoped overrides for glass-effects inside admin layout */
        .glass-effect {
          background: rgba(18, 26, 22, 0.65) !important;
          backdrop-filter: blur(20px) !important;
          -webkit-backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(1, 30, 2, 0.2) !important;
        }
        .glass-dark-effect {
          background: rgba(10, 15, 12, 0.8) !important;
          backdrop-filter: blur(25px) !important;
          -webkit-backdrop-filter: blur(25px) !important;
          border: 1px solid rgba(1, 30, 2, 0.2) !important;
        }

        /* Orders filters & ID mask */
        .orders-filters-bar {
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .orders-search-date-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: nowrap;
        }
        .orders-search-date-row .search-box-wrapper {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 5px 10px;
        }
        .orders-search-input {
          flex: 1;
          min-width: 0;
        }
        .orders-date-input {
          flex: 0 0 130px;
          max-width: 130px;
        }
        .orders-search-date-row input {
          border: none;
          background: transparent;
          color: #fff;
          outline: none;
          width: 100%;
          font-size: 12px;
          color-scheme: dark;
          text-align: left;
        }
        .orders-search-date-row input::placeholder {
          text-align: left;
          color: rgba(255, 255, 255, 0.45);
        }
        .search-box-wrapper input {
          border: none;
          background: transparent;
          color: #fff;
          outline: none;
          width: 100%;
          font-size: 12px;
          text-align: left;
          line-height: 28px;
          min-height: 28px;
        }
        .search-box-wrapper input::placeholder {
          text-align: left;
          color: rgba(255, 255, 255, 0.45);
        }
        .orders-filters-bar .filter-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-tab-btn {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .filter-tab-btn:hover:not(.active) {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .filter-tab-btn.active {
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }
        .order-status-toggle.is-undo-pending {
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
          color: #000000 !important;
        }
        .order-status-toggle.is-undo-pending:hover:not(:disabled) {
          background: #f0f0f0 !important;
        }
        .icon-action-btn.order-undo-btn {
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
          color: #000000 !important;
        }
        .icon-action-btn.order-undo-btn:hover:not(:disabled) {
          background: #f0f0f0 !important;
        }
        .order-undo-drawer-btn {
          margin-top: 10px;
          padding: 8px 14px;
          border-radius: 6px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: #ffffff;
          color: #000000;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .order-undo-drawer-btn:hover:not(:disabled) {
          background: #f0f0f0;
        }
        .order-undo-drawer-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .order-id-cell {
          display: flex;
          align-items: center;
          gap: 4px;
          max-width: 88px;
        }
        .order-id-text {
          font-size: 11px;
          line-height: 1.2;
        }
        .order-id-text.masked {
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.45);
        }
        .order-id-text.revealed {
          word-break: break-all;
          max-width: 72px;
        }
        .order-id-toggle {
          flex-shrink: 0;
          padding: 2px 5px !important;
        }

        /* Action Buttons */
        .icon-action-btn {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          padding: 3px 7px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 600;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .icon-action-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .icon-action-btn.edit {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.25);
        }
        .icon-action-btn.edit:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .icon-action-btn.delete {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .icon-action-btn.delete:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
        .order-row-actions-cell {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .order-cancel-btn {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 4px 8px;
          min-width: auto;
        }
        .order-cancel-drawer-btn {
          margin-top: 10px;
          padding: 8px 14px;
          border-radius: 6px;
          border: 1px solid rgba(255, 100, 100, 0.45);
          background: rgba(255, 80, 80, 0.12);
          color: #ffb4b4;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .order-cancel-drawer-btn:hover:not(:disabled) {
          background: rgba(255, 80, 80, 0.22);
          border-color: rgba(255, 120, 120, 0.65);
        }
        .order-cancel-drawer-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .btn-status-transition {
          border: none;
          background: #011E02;
          color: #fff;
          padding: 3px 8px;
          margin: 0 2px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-status-transition.delivered {
          background: rgba(46, 125, 50, 0.35);
          color: #c8e6c9;
        }
        .btn-status-transition.delivered:hover {
          background: rgba(46, 125, 50, 0.55);
        }
        .details-overlay-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          justify-content: flex-end;
          z-index: 1000;
          overflow-y: auto;
        }
        .details-overlay-backdrop.form-modal-overlay {
          justify-content: center;
          align-items: center;
          padding: 20px 16px;
          box-sizing: border-box;
        }
        .details-drawer {
          width: 100%;
          max-width: 500px;
          height: 100%;
          background: #0A0B09;
          border-left: 1px solid rgba(255,255,255,0.1);
          display: flex;
          flex-direction: column;
        }
        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .drawer-header h4 { font-family: var(--font-poppins)"Playfair Display", serif; font-size: 24px; margin: 0; font-weight: 700; }
        .btn-close { border: none; background: transparent; color: #fff; font-size: 24px; cursor: pointer; }
        .drawer-body { padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 20px; }
        .drawer-section { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
        .drawer-section p { margin: 0; font-size: 14px; line-height: 1.55; color: rgba(255,255,255,0.92); }
        .drawer-section p strong { font-size: 13px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em; }
        .section-label { font-size: 12px; color: rgba(255,255,255,0.72) !important; font-weight: 800; letter-spacing: 1.4px; margin-bottom: 6px; text-transform: uppercase; }
        .drawer-status-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
        .order-status-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          padding: 4px 10px !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          min-width: 96px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.22) !important;
          background: rgba(255,255,255,0.12) !important;
          color: #ffffff !important;
        }
        .order-status-toggle:disabled {
          opacity: 0.75;
          cursor: wait;
        }
        .order-status-toggle.is-pending {
          background: rgba(255,255,255,0.12) !important;
          color: #ffffff !important;
        }
        .order-status-toggle.is-pending:hover:not(:disabled) {
          background: #E8C547 !important;
          border-color: #F0D875 !important;
          color: #011E02 !important;
        }
        .order-status-toggle.is-completed {
          background: #ffffff !important;
          border-color: rgba(0, 0, 0, 0.15) !important;
          color: #000000 !important;
        }
        .order-status-toggle.is-completed:hover:not(:disabled) {
          background: #f0f0f0 !important;
          color: #000000 !important;
        }
        .special-notes-box { background: rgba(255, 255, 255, 0.02); border-left: 2px solid rgba(255,255,255,0.3); padding: 8px; margin-top: 5px; }
        .drawer-items-list { display: flex; flex-direction: column; gap: 10px; }
        .drawer-item-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 5px; }
        .addons-sub { font-size: 11px; color: rgba(255,255,255,0.5); margin: 2px 0 0 0; }
        .billing-summary { background: rgba(255,255,255,0.01); padding: 12px; border-radius: 6px; }
        .bill-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .bill-row.saving { color: #d4af37 !important; }
        .bill-row.total { font-size: 15px; font-weight: 700; margin-top: 10px; }
        .form-modal-box {
          margin: auto;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 30px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          box-sizing: border-box;
          position: relative;
        }
        .form-modal-overlay .form-modal-box {
          margin: 0;
          width: 100%;
        }
        .admin-form-modal {
          background: rgba(8, 10, 9, 0.98) !important;
          backdrop-filter: blur(28px) !important;
          -webkit-backdrop-filter: blur(28px) !important;
          border: 1px solid rgba(212, 175, 55, 0.18) !important;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
        }
        .admin-form-modal.admin-form-modal--wide {
          max-width: 640px;
        }
        .form-modal-box h4 {
          font-family: var(--font-poppins)"Playfair Display", serif;
          font-size: 20px;
          margin-top: 0;
          margin-bottom: 20px;
          color: #fff;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 10px;
        }
        .form-row { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 15px; 
          margin-bottom: 15px; 
          box-sizing: border-box;
        }
        .form-row.form-row-full {
          grid-template-columns: 1fr;
        }
        .input-group { 
          display: flex; 
          flex-direction: column; 
          gap: 5px; 
          font-size: 12px; 
          box-sizing: border-box;
          width: 100%;
        }
        .input-group label { 
          color: rgba(255,255,255,0.6); 
          min-height: 36px;
          display: flex;
          align-items: flex-end;
          margin-bottom: 5px;
        }
        .customer-order-log-item:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .input-group input, .input-group select, .input-group textarea {
          background: rgba(10, 15, 12, 0.6);
          border: 1px solid rgba(1, 30, 2, 0.2);
          color: #fff;
          padding: 8px 12px;
          border-radius: 4px;
          font-family: var(--font-poppins)'Inter', sans-serif;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          text-align: left;
        }
        .input-group input:not([type="date"]):not([type="time"]):not([type="datetime-local"]) {
          min-height: 38px;
          line-height: calc(38px - 2px);
        }
        .input-group textarea {
          height: auto;
          line-height: 1.5;
          resize: none;
        }
        .input-group textarea[rows="2"]:placeholder-shown {
          padding-top: calc(8px + 0.75em);
          padding-bottom: calc(8px - 0.75em);
        }
        .input-group textarea[rows="3"]:placeholder-shown {
          padding-top: calc(8px + 1.5em);
          padding-bottom: calc(8px - 1.5em);
        }
        .input-group textarea[rows="4"]:placeholder-shown {
          padding-top: calc(8px + 2.25em);
          padding-bottom: calc(8px - 2.25em);
        }
        .input-group input::placeholder,
        .input-group textarea::placeholder {
          text-align: left;
          color: rgba(255, 255, 255, 0.45);
          line-height: inherit;
        }
        .input-group input:focus, .input-group select:focus, .input-group textarea:focus {
          border-color: #011E02;
        }
        .input-group select {
          color-scheme: dark;
          cursor: pointer;
        }
        .input-group select option {
          background-color: #0c1410 !important;
          color: #ffffff !important;
        }
        .input-group input:user-invalid,
        .input-group select:user-invalid,
        .input-group textarea:user-invalid {
          border-color: #ef5350 !important;
          box-shadow: 0 0 0 1px rgba(239, 83, 80, 0.35);
        }
        .input-group input:user-invalid:focus,
        .input-group select:user-invalid:focus,
        .input-group textarea:user-invalid:focus {
          border-color: #ef5350 !important;
          box-shadow: 0 0 0 2px rgba(239, 83, 80, 0.2);
        }
        .input-group input.decimal-input {
          -moz-appearance: textfield;
        }
        .input-group input.decimal-input::-webkit-outer-spin-button,
        .input-group input.decimal-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="date"], input[type="datetime-local"], input[type="time"] {
          color-scheme: dark !important;
          background: rgba(10, 15, 12, 0.6) !important;
          border: 1px solid rgba(1, 30, 2, 0.2) !important;
          color: #fff !important;
          padding: 6px 10px !important;
          border-radius: 4px !important;
          outline: none !important;
          font-family: var(--font-poppins)'Inter', sans-serif !important;
          cursor: pointer !important;
        }
        .admin-console-layout select,
        button, select, input[type="checkbox"], input[type="date"], input[type="datetime-local"], input[type="time"] {
          cursor: pointer !important;
        }
        .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; }
        :global(.admin-console-layout button.stock-toggle-pill.active) {
          background: rgba(46, 125, 50, 0.28);
          color: #A5D6A7;
          border-color: rgba(67, 160, 71, 0.55);
        }
        :global(.admin-console-layout button.stock-toggle-pill.sold-out) {
          background: rgba(198, 40, 40, 0.22);
          color: #EF9A9A;
          border-color: rgba(229, 57, 53, 0.5);
        }
        :global(.admin-console-layout button.stock-toggle-pill.active .loading-btn-label),
        :global(.admin-console-layout button.stock-toggle-pill.sold-out .loading-btn-label) {
          -webkit-text-fill-color: currentColor;
        }

        /* Product image upload — custom file picker for dark admin UI */
        :global(.product-image-upload) {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        :global(.product-image-upload__label) {
          color: rgba(255,255,255,0.6);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        :global(.product-image-upload__picker) {
          display: flex;
          align-items: stretch;
          gap: 0;
          width: 100%;
          min-height: 42px;
          border-radius: 6px;
          border: 1px solid rgba(1, 30, 2, 0.35);
          background: rgba(6, 8, 7, 0.95);
          overflow: hidden;
        }
        :global(.product-image-upload__input) {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        :global(.product-image-upload__btn) {
          flex-shrink: 0;
          border: none;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-family: var(--font-poppins)'Inter', sans-serif;
          font-size: 12px;
          font-weight: 600;
          padding: 0 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        :global(.product-image-upload__btn:hover:not(:disabled)) {
          background: rgba(212, 175, 55, 0.18);
        }
        :global(.product-image-upload__btn:disabled) {
          opacity: 0.55;
          cursor: not-allowed;
        }
        :global(.product-image-upload__filename) {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          padding: 0 12px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        :global(.product-image-upload__hint) {
          color: rgba(255,255,255,0.45);
          font-size: 11px;
          line-height: 1.4;
        }
        :global(.product-image-upload__error) {
          margin: 0;
          color: #ff8a8a;
          font-size: 12px;
        }
        :global(.product-image-upload__status) {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.75);
          font-size: 12px;
        }
        :global(.product-image-upload__preview-wrap) {
          margin-top: 4px;
          width: 100%;
          max-width: 160px;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
        }
        :global(.product-image-upload__preview-wrap img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        @media (max-width: 900px) {
          :global(.product-image-upload__picker) {
            flex-direction: column;
            min-height: 0;
          }
          :global(.product-image-upload__btn) {
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding: 10px 16px;
            width: 100%;
          }
          :global(.product-image-upload__filename) {
            padding: 10px 12px;
          }
          :global(.product-image-upload__preview-wrap) {
            max-width: 140px;
          }
        }

        @media (max-width: 1100px) {
          .dashboard-charts-grid {
            grid-template-columns: 1fr !important;
            gap: 20px;
          }
        }
        @media (max-width: 900px) {
          .sidebar-toggle-trigger {
            display: inline-flex !important;
            border: none;
            background: rgba(255, 255, 255, 0.05);
            padding: 8px;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            align-items: center;
            justify-content: center;
          }
          .sidebar-close-btn-mobile {
            display: inline-block !important;
          }
          .console-sidebar {
            position: fixed !important;
            top: 0;
            left: 0;
            z-index: 1001;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            height: 100vh;
            background: #0A0B09 !important;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
          }
          .console-sidebar.open {
            transform: translateX(0);
          }
          .sidebar-backdrop-mobile {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 1000;
          }
          .console-main-content {
            width: 100%;
            padding: 15px;
          }
          .console-header-bar {
            margin-bottom: 18px;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 10px;
          }
          .header-subtitle-tag {
            font-size: 9px;
            letter-spacing: 1.2px;
          }
          .header-title {
            font-size: 17px;
            line-height: 1.2;
            max-width: 100%;
          }
          .header-actions :global(.refresh-sync-btn) {
            font-size: 11px;
            padding: 8px 10px;
          }
          .form-row {
            grid-template-columns: 1fr;
          }
          .form-modal-box {
            padding: 20px;
            max-height: calc(100vh - 32px);
          }
          .form-modal-overlay {
            padding: 12px;
          }
          .dashboard-charts-grid {
            grid-template-columns: 1fr !important;
            gap: 15px;
          }
        }
      `}</style>
    </div>
  );
}
