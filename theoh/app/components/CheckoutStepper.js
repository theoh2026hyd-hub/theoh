"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Check, CreditCard, Landmark, Truck, ShieldCheck, ShoppingCart, Award, ExternalLink, Trash2, MapPin } from "lucide-react";
import InlineDeliveryMap from "./InlineDeliveryMap";
import ProductDetailsModal from "./ProductDetailsModal";
import TermsOfServiceBlock from "./TermsOfServiceBlock";
import { hasMapLinkInAddress, getDeliveryRouteMapEmbedUrl, getDeliveryRouteMapLink } from "../lib/delivery";
import { calculateCoinsEarned } from "../lib/coins";
import { getSettingNumber, hasSettingsLoaded, canRedeemCoins, getCoinsRedemptionSettings, getDeliveryPricingSettings, formatDeliveryPricingLabel } from "../lib/settings";
import { getAvailableTimeSlotsForDate, getOrderDateBounds, isOrderDateInRange } from "../lib/deliveryTimeSlots";
import { parseJsonResponse } from "../lib/fetchJson";
import { isValidPhone, sanitizePhoneInput, applyPhoneInputChange, getPhoneValidationError, PHONE_EXACT_LENGTH_ERROR } from "../lib/phone";
import { useOverlayBack, backOverlayHistory } from "../lib/overlayHistory";
import { saveCheckoutResumeDraft } from "../lib/checkoutResume";
import { getRestaurantLocationLabel, getRestaurantMapLink } from "../lib/restaurantLocation";
import SafeImage from "./SafeImage";

export default function CheckoutStepper({ 
  orderSummary, 
  cartItems, 
  onOrderSuccess, 
  onClose,
  onAddMoreItems,
  addUserCoins,
  onViewDashboard,
  onNavigateAfterSuccess,
  settings = {},
  syncedPhone = "",
  activeCoupons = [],
  menuItems = [],
  onAddToCart,
  onUpdateCartItem,
  onRemoveCartItem,
  userCoins = 0,
  checkoutSource = "home",
  resumeDraft = null,
  onResumeConsumed = null,
}) {
  const [step, setStep] = useState(1); // 1: Dining/Suite, 2: Selections, 3: Payment, 4: Confirmation
  const stepperTopRef = useRef(null);
  const [addressData, setAddressData] = useState({
    name: "",
    phone: syncedPhone,
    diningMode: "delivery", // delivery, table
    location: "",
    tableNo: "",
    specialNotes: "",
    deliveryDate: "",
    deliveryTimeSlot: ""
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [userOrderCount, setUserOrderCount] = useState(0);
  const [usedCouponCodes, setUsedCouponCodes] = useState([]);
  const [saveAddressLoading, setSaveAddressLoading] = useState(false);
  const addressAutoSaveRef = useRef("");

  const loadCheckoutProfile = useCallback(async (phone) => {
    const cleanPhone = sanitizePhoneInput(phone);
    if (!isValidPhone(cleanPhone)) {
      setSavedAddresses([]);
      setUsedCouponCodes([]);
      setUserOrderCount(0);
      return;
    }

    try {
      const res = await fetch(`/api/user?phone=${cleanPhone}`);
      const text = await res.text();
      const trimmed = (text || "").trim();
      if (!trimmed) return;

      const data = JSON.parse(trimmed);
      if (!data.success) return;

      const profileAddresses = [];
      const walletAddress = data.wallet?.deliveryAddress;
      if (walletAddress && hasMapLinkInAddress(walletAddress)) {
        profileAddresses.push(walletAddress);
      }
      if (Array.isArray(data.addresses)) {
        for (const addr of data.addresses) {
          if (addr && hasMapLinkInAddress(addr) && !profileAddresses.includes(addr)) {
            profileAddresses.push(addr);
          }
        }
      }

      setSavedAddresses(profileAddresses);
      if (data.wallet) {
        setUserOrderCount(data.wallet.orderCount || 0);
      }
      if (data.usedCouponCodes) {
        setUsedCouponCodes(data.usedCouponCodes.map((c) => c.toUpperCase()));
      }

      setAddressData((prev) => ({
        ...prev,
        name: prev.name || data.wallet?.customerName || "",
        location:
          prev.location ||
          (profileAddresses[0] && hasMapLinkInAddress(profileAddresses[0])
            ? profileAddresses[0]
            : prev.location),
      }));
    } catch (err) {
      console.error("Error fetching user profile for checkout:", err);
    }
  }, []);

  useEffect(() => {
    if (!syncedPhone) return;
    setAddressData((prev) => ({
      ...prev,
      phone: prev.phone || sanitizePhoneInput(syncedPhone),
    }));
  }, [syncedPhone]);

  useEffect(() => {
    loadCheckoutProfile(addressData.phone);
  }, [addressData.phone, loadCheckoutProfile]);

  const primarySavedAddress = savedAddresses[0] || "";
  const hasPinnedLocation = hasMapLinkInAddress(addressData.location);
  const canSaveAddress =
    hasPinnedLocation &&
    isValidPhone(sanitizePhoneInput(addressData.phone)) &&
    addressData.location !== primarySavedAddress;

  const persistDefaultAddress = useCallback(async (locationOverride = null) => {
    const phone = sanitizePhoneInput(addressData.phone);
    const location = String(locationOverride || addressData.location || "").trim();
    const name = addressData.name.trim() || "User";

    if (!isValidPhone(phone) || !hasMapLinkInAddress(location)) return false;
    if (location === primarySavedAddress || location === addressAutoSaveRef.current) return true;

    addressAutoSaveRef.current = location;
    setSaveAddressLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          customerName: name,
          deliveryAddress: location,
        }),
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setSavedAddresses([location]);
        return true;
      }
      addressAutoSaveRef.current = "";
      return false;
    } catch (err) {
      console.error("Failed to save checkout address:", err);
      addressAutoSaveRef.current = "";
      return false;
    } finally {
      setSaveAddressLoading(false);
    }
  }, [addressData.phone, addressData.location, addressData.name, primarySavedAddress]);

  const [appAlert, setAppAlert] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const showAlert = (message) => setAppAlert({ message });

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const inputInvalidClass = (field) => (fieldErrors[field] ? " input-invalid" : "");

  const validateStep1 = () => {
    const errors = {};
    const name = addressData.name.trim();
    const phone = sanitizePhoneInput(addressData.phone);

    if (!name) {
      errors.name = "Please enter your guest name.";
    } else if (name.length < 2) {
      errors.name = "Name must be at least 2 characters.";
    }

    if (!phone) {
      errors.phone = "Please enter your phone number.";
    } else if (!isValidPhone(phone)) {
      errors.phone = getPhoneValidationError(phone) || "Enter a valid 10-digit phone number.";
    }

    if (addressData.diningMode === "delivery") {
      if (!hasMapLinkInAddress(addressData.location)) {
        errors.location = "Pin your delivery location on the map.";
      } else if (deliveryFeeInfo.withinRadius === false) {
        // Error is already shown once under the map — keep step blocked without a second copy.
        errors.location = "__delivery_radius__";
      } else if (deliveryFeeLoading) {
        errors.location = "Please wait while we calculate your delivery distance.";
      }
    } else if (!addressData.tableNo.trim()) {
      errors.tableNo = "Enter your preferred pickup time.";
    }

    if (!addressData.deliveryDate.trim()) {
      errors.deliveryDate = "Select a delivery or pickup date.";
    } else if (!isOrderDateInRange(addressData.deliveryDate.trim())) {
      errors.deliveryDate = "Choose a date within the next 7 days.";
    }

    if (!addressData.deliveryTimeSlot.trim()) {
      errors.deliveryTimeSlot =
        availableTimeSlots.length > 0
          ? "Select a time slot."
          : "No time slots are available for this date.";
    }

    return errors;
  };

  const scrollToFirstFieldError = (errors) => {
    const order = ["name", "phone", "location", "tableNo", "deliveryDate", "deliveryTimeSlot"];
    const firstField = order.find((field) => errors[field]);
    if (!firstField || typeof document === "undefined") return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-checkout-field="${firstField}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };
  const [paymentMethod, setPaymentMethod] = useState("card"); // card, netbanking, upi
  const [cardData, setCardData] = useState({
    number: "•••• •••• •••• 9284",
    expiry: "09/29",
    cvc: "•••",
    name: "User"
  });

  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle, processing, success
  const [showMockSimulator, setShowMockSimulator] = useState(false);
  const [mockOrderDetails, setMockOrderDetails] = useState(null);

  // Local coupon state for Step 3
  const [localPromoPercent, setLocalPromoPercent] = useState(0);
  const [localPromoCode, setLocalPromoCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");
  const [useCoinsLocal, setUseCoinsLocal] = useState(false);
  const deliveryPricing = useMemo(() => getDeliveryPricingSettings(settings), [settings]);
  const deliveryPricingLabel = useMemo(() => formatDeliveryPricingLabel(settings), [settings]);
  const defaultDeliveryFee = deliveryPricing.baseFee;
  const [deliveryFeeInfo, setDeliveryFeeInfo] = useState({
    deliveryFee: defaultDeliveryFee,
    distanceKm: null,
    coordsFound: false,
    distanceMethod: "bike",
    coordSource: null,
    withinRadius: true,
    maxKm: deliveryPricing.maxKm ?? 50,
    routeEmbedUrl: null,
    routeMapLink: null
  });
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(false);
  const [deliveryRadiusError, setDeliveryRadiusError] = useState("");
  const [detailItem, setDetailItem] = useState(null);
  const [detailCartIndex, setDetailCartIndex] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [confirmedSnapshot, setConfirmedSnapshot] = useState(null);
  const [serverTotals, setServerTotals] = useState(null);
  const [serverTotalsLoading, setServerTotalsLoading] = useState(false);
  const [serverQuoteError, setServerQuoteError] = useState("");

  useEffect(() => {
    if (!resumeDraft) return;
    if (resumeDraft.step) setStep(resumeDraft.step);
    if (resumeDraft.addressData) {
      setAddressData((prev) => ({ ...prev, ...resumeDraft.addressData }));
    }
    if (resumeDraft.localPromoCode) setLocalPromoCode(resumeDraft.localPromoCode);
    if (resumeDraft.localPromoPercent) setLocalPromoPercent(resumeDraft.localPromoPercent);
    if (resumeDraft.useCoinsLocal) setUseCoinsLocal(true);
    if (resumeDraft.showConfirmModal) {
      setShowConfirmModal(true);
    }
    onResumeConsumed?.();
  }, [resumeDraft, onResumeConsumed]);

  const checkoutOverlayId =
    step < 4 && !confirmedSnapshot
      ? showConfirmModal
        ? "checkout-confirm"
        : detailItem
          ? "checkout-product-details"
          : `checkout-step-${step}`
      : null;

  useOverlayBack(Boolean(checkoutOverlayId), checkoutOverlayId, () => {
    if (showConfirmModal) {
      setShowConfirmModal(false);
      return;
    }
    if (detailItem) {
      setDetailItem(null);
      setDetailCartIndex(null);
      return;
    }
    if (step > 1) {
      setStep((current) => Math.max(1, current - 1));
      return;
    }
    onClose?.();
  });

  const packingCharge = getSettingNumber(settings, "packing_charge");
  const gstPercent = getSettingNumber(settings, "gst_percent");
  const settingsReady = hasSettingsLoaded(settings);
  const activePackingFee = packingCharge ?? 0;
  const activeDeliveryFee =
    addressData.diningMode === "delivery" ? deliveryFeeInfo.deliveryFee : 0;

  const deliveryDistanceLabel =
    deliveryFeeInfo.distanceKm != null
      ? deliveryFeeInfo.distanceMethod === "bike"
        ? `${deliveryFeeInfo.distanceKm} km shortest two-wheeler route`
        : `${deliveryFeeInfo.distanceKm} km from kitchen`
      : null;

  useEffect(() => {
    if (addressData.diningMode !== "delivery" || !addressData.location.trim()) {
      setDeliveryRadiusError("");
      setDeliveryFeeInfo({
        deliveryFee: 0,
        distanceKm: null,
        coordsFound: false,
        distanceMethod: "bike",
        withinRadius: true,
        maxKm: deliveryPricing.maxKm ?? 50,
        routeEmbedUrl: null,
        routeMapLink: null
      });
      return;
    }

    if (!hasMapLinkInAddress(addressData.location)) {
      setDeliveryRadiusError("");
      setDeliveryFeeInfo({
        deliveryFee: defaultDeliveryFee,
        distanceKm: null,
        coordsFound: false,
        distanceMethod: "unknown",
        coordSource: null,
        withinRadius: true,
        maxKm: deliveryPricing.maxKm ?? 50,
        routeEmbedUrl: null,
        routeMapLink: null
      });
      setDeliveryFeeLoading(false);
      return;
    }

    let cancelled = false;
    setDeliveryFeeLoading(true);
    setDeliveryRadiusError("");

    const fetchDeliveryFee = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch("/api/delivery/fee", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: addressData.location })
          });
          const data = await parseJsonResponse(res);
          if (cancelled) return;

          if (data.withinRadius === false || (!data.success && data.distanceKm != null && data.maxKm != null && data.distanceKm > data.maxKm)) {
            setDeliveryFeeInfo({
              deliveryFee: 0,
              distanceKm: data.distanceKm,
              coordsFound: Boolean(data.coordsFound),
              distanceMethod: data.distanceMethod || "bike",
              coordSource: data.coordSource || "map_link",
              withinRadius: false,
              maxKm: data.maxKm ?? deliveryPricing.maxKm ?? 50,
              routeEmbedUrl: data.routeEmbedUrl || null,
              routeMapLink: data.routeMapLink || null
            });
            setDeliveryRadiusError(
              data.error ||
                `Delivery is available only within ${data.maxKm ?? deliveryPricing.maxKm ?? 50} km of our kitchen.`
            );
            setDeliveryFeeLoading(false);
            return;
          }

          if (data.success) {
            setDeliveryFeeInfo({
              deliveryFee: data.deliveryFee,
              distanceKm: data.distanceKm,
              coordsFound: data.coordsFound,
              distanceMethod: data.distanceMethod || "bike",
              coordSource: data.coordSource || "map_link",
              withinRadius: true,
              maxKm: data.maxKm ?? deliveryPricing.maxKm ?? 50,
              routeEmbedUrl: data.routeEmbedUrl || null,
              routeMapLink: data.routeMapLink || null
            });
            setDeliveryRadiusError("");
            setDeliveryFeeLoading(false);
            return;
          }
        } catch (err) {
          console.error("Delivery fee fetch failed:", err);
          if (attempt === 0) continue;
        }
      }

      if (!cancelled) {
        setDeliveryFeeLoading(false);
        setDeliveryRadiusError("");
        setDeliveryFeeInfo({
          deliveryFee: defaultDeliveryFee,
          distanceKm: null,
          coordsFound: false,
          distanceMethod: "unknown",
          coordSource: null,
          withinRadius: true,
          maxKm: deliveryPricing.maxKm ?? 50,
          routeEmbedUrl: null,
          routeMapLink: null
        });
      }
    };

    const timer = setTimeout(fetchDeliveryFee, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addressData.location, addressData.diningMode, defaultDeliveryFee, deliveryPricing.maxKm]);

  // Silently save a valid in-radius pin as the default address in user_details
  useEffect(() => {
    if (addressData.diningMode !== "delivery") return;
    if (!canSaveAddress || saveAddressLoading) return;
    if (deliveryFeeLoading || deliveryFeeInfo.withinRadius === false) return;
    if (!hasPinnedLocation || deliveryFeeInfo.distanceKm == null) return;

    persistDefaultAddress(addressData.location);
  }, [
    addressData.diningMode,
    addressData.location,
    canSaveAddress,
    saveAddressLoading,
    deliveryFeeLoading,
    deliveryFeeInfo.withinRadius,
    deliveryFeeInfo.distanceKm,
    hasPinnedLocation,
    persistDefaultAddress
  ]);

  const RESERVE10_MIN = 350;
  const orderDateBounds = getOrderDateBounds();
  const availableTimeSlots = useMemo(
    () => getAvailableTimeSlotsForDate(settings, addressData.deliveryDate),
    [settings, addressData.deliveryDate]
  );

  useEffect(() => {
    if (
      addressData.deliveryDate &&
      !isOrderDateInRange(addressData.deliveryDate)
    ) {
      setAddressData((prev) => ({ ...prev, deliveryDate: "", deliveryTimeSlot: "" }));
    }
  }, [addressData.deliveryDate]);

  const couponMeetsMinimum = (coupon, subtotal) => {
    const minAmount = parseFloat(coupon.min_order_amount || 0);
    if (minAmount > 0) return subtotal >= minAmount;
    if (coupon.code?.toUpperCase() === "RESERVE10") return subtotal >= RESERVE10_MIN;
    return true;
  };

  const liveSubtotal = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const unit = item.price + (item.addonsTotal || 0);
        return total + unit * item.quantity;
      }, 0),
    [cartItems]
  );

  const gstRate = gstPercent !== null ? gstPercent / 100 : 0;
  const availableCoins = userCoins || orderSummary.userCoins || 0;
  const coinsRedemptionSettings = useMemo(() => getCoinsRedemptionSettings(settings), [settings]);
  const coinsCanRedeem = useMemo(
    () => canRedeemCoins(settings, liveSubtotal),
    [settings, liveSubtotal]
  );

  // Coins discount: 1 coin = ₹1, capped at subtotal
  const localCoinDiscount =
    coinsCanRedeem && (useCoinsLocal || orderSummary.useCoins)
      ? Math.min(liveSubtotal, availableCoins * 1)
      : 0;

  const appliedPromoVal =
    localPromoPercent > 0
      ? (liveSubtotal - localCoinDiscount) * localPromoPercent
      : 0;

  const taxableAmount = Math.max(0, liveSubtotal - localCoinDiscount - appliedPromoVal);
  const liveTax = parseFloat((taxableAmount * gstRate).toFixed(2));
  const currentGrandTotal = parseFloat(
    (taxableAmount + liveTax + activePackingFee + activeDeliveryFee).toFixed(2)
  );

  const quotedSubtotal = serverTotals?.subtotal ?? liveSubtotal;
  const quotedCoinDiscount = serverTotals?.coinDiscount ?? localCoinDiscount;
  const quotedPromoDiscount = serverTotals?.promoDiscount ?? appliedPromoVal;
  const quotedTax = serverTotals?.tax ?? liveTax;
  const quotedPackingFee = serverTotals?.packingFee ?? activePackingFee;
  const quotedDeliveryFee = serverTotals?.deliveryFee ?? activeDeliveryFee;
  const quotedGrandTotal = serverTotals?.grandTotal ?? currentGrandTotal;

  const getCheckoutDeliveryAddress = () =>
    addressData.diningMode === "delivery"
      ? addressData.location
      : `Takeaway (Pickup: ${addressData.tableNo})`;

  useEffect(() => {
    const phone = addressData.phone?.trim();
    if (!phone || cartItems.length === 0) {
      setServerTotals(null);
      setServerQuoteError("");
      return;
    }

    let cancelled = false;
    setServerTotalsLoading(true);
    setServerQuoteError("");

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartItems,
            customerPhone: phone,
            couponCode: localPromoCode || orderSummary.couponCode || "",
            useCoins: coinsCanRedeem && (useCoinsLocal || orderSummary.useCoins),
            deliveryAddress: getCheckoutDeliveryAddress()
          })
        });
        const data = await parseJsonResponse(res);
        if (cancelled) return;
        if (data.success) {
          setServerTotals(data.totals);
          setServerQuoteError("");
        } else {
          setServerTotals(null);
          setServerQuoteError(data.error || "Unable to calculate order total.");
        }
      } catch (err) {
        if (!cancelled) {
          setServerTotals(null);
          setServerQuoteError("Unable to refresh order total.");
        }
      } finally {
        if (!cancelled) setServerTotalsLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    cartItems,
    addressData.phone,
    addressData.diningMode,
    addressData.location,
    addressData.tableNo,
    localPromoCode,
    orderSummary.couponCode,
    useCoinsLocal,
    orderSummary.useCoins,
    coinsCanRedeem
  ]);

  const allSelectableCodes = useMemo(() => [...activeCoupons], [activeCoupons]);

  const applicableCoupons = useMemo(() => allSelectableCodes.filter((coupon) => {
    const code = coupon.code.toUpperCase();
    if (coupon.phone_restriction && coupon.phone_restriction.trim() !== addressData.phone.trim()) return false;
    if (code.includes("WELCOME") && userOrderCount > 0) return false;
    if (code.includes("RESERVE") && code !== "RESERVE10" && userOrderCount === 0) return false;
    if (code === "RESERVE10" && !couponMeetsMinimum({ code, min_order_amount: RESERVE10_MIN }, liveSubtotal)) return false;
    if (!couponMeetsMinimum(coupon, liveSubtotal)) return false;
    if (code !== "RESERVE10" && usedCouponCodes.includes(code)) return false;
    return true;
  }), [allSelectableCodes, addressData.phone, userOrderCount, usedCouponCodes, liveSubtotal]);

  const visibleCoupons = useMemo(() => {
    const cleanPhone = addressData.phone.replace(/[^0-9]/g, "");
    return allSelectableCodes.filter((coupon) => {
      if (coupon.phone_restriction && coupon.phone_restriction.trim() !== addressData.phone.trim()) {
        return false;
      }
      return cleanPhone.length >= 10 || !coupon.phone_restriction;
    });
  }, [allSelectableCodes, addressData.phone]);

  const getCouponMinAmount = (coupon) => {
    const code = coupon.code.toUpperCase();
    const minAmount = parseFloat(coupon.min_order_amount || 0);
    if (minAmount > 0) return minAmount;
    if (code === "RESERVE10") return RESERVE10_MIN;
    return 0;
  };

  const getCouponEligibilityMessage = (coupon) => {
    const code = coupon.code.toUpperCase();
    const effectiveMin = getCouponMinAmount(coupon);
    const minNote =
      effectiveMin > 0 ? ` Minimum order ₹${effectiveMin.toFixed(0)}.` : "";

    if (code.includes("WELCOME") && userOrderCount > 0) {
      return {
        eligible: false,
        message: `Not eligible — first-time customers only.${minNote}`
      };
    }
    if (code.includes("RESERVE") && code !== "RESERVE10" && userOrderCount === 0) {
      return { eligible: false, message: "Not eligible — returning customers only." };
    }
    if (code !== "RESERVE10" && usedCouponCodes.includes(code)) {
      return { eligible: false, message: "Not eligible — you have already used this coupon." };
    }
    if (effectiveMin > 0 && liveSubtotal < effectiveMin) {
      const welcomeLead = code.includes("WELCOME") ? "first-time offer, " : "";
      return {
        eligible: false,
        message: `Not eligible — ${welcomeLead}minimum item total ₹${effectiveMin.toFixed(0)} required (current: ₹${liveSubtotal.toFixed(2)}).`
      };
    }
    if (effectiveMin > 0) {
      return {
        eligible: true,
        message:
          code.includes("WELCOME")
            ? `Eligible — first-time offer, min order ₹${effectiveMin.toFixed(0)}.`
            : `Eligible — item total meets the ₹${effectiveMin.toFixed(0)} minimum.`
      };
    }
    if (code.includes("WELCOME")) {
      return {
        eligible: true,
        message: "Eligible — first-time customer offer, no minimum order."
      };
    }
    return { eligible: true, message: "Eligible — no minimum order amount required." };
  };

  const getCouponDropdownHint = (coupon) => {
    const { eligible, message } = getCouponEligibilityMessage(coupon);
    const effectiveMin = getCouponMinAmount(coupon);
    const isWelcome = coupon.code.toUpperCase().includes("WELCOME");

    if (eligible) {
      if (effectiveMin > 0) {
        return isWelcome
          ? `Available — first-time only, min ₹${effectiveMin.toFixed(0)}`
          : `Available — min order ₹${effectiveMin.toFixed(0)}`;
      }
      if (isWelcome) {
        return "Available — first-time customers only";
      }
      return "Available — select to apply";
    }
    return message.replace(/^Not eligible —\s*/i, "Need: ");
  };

  const handleOfferSelect = (selectedCode) => {
    if (!selectedCode) {
      setLocalPromoCode("");
      setLocalPromoPercent(0);
      setCouponSuccess("");
      setCouponError("");
      return;
    }

    const selected = applicableCoupons.find((c) => c.code.toUpperCase() === selectedCode.toUpperCase());
    if (!selected) {
      setLocalPromoCode("");
      setLocalPromoPercent(0);
      const fallback = allSelectableCodes.find((c) => c.code.toUpperCase() === selectedCode.toUpperCase());
      const minAmount = parseFloat(fallback?.min_order_amount || 0);
      if (selectedCode.toUpperCase() === "RESERVE10" && !couponMeetsMinimum({ code: "RESERVE10", min_order_amount: RESERVE10_MIN }, liveSubtotal)) {
        setCouponError(`RESERVE10 requires item total of ₹${RESERVE10_MIN} or more (current: ₹${liveSubtotal.toFixed(2)}).`);
      } else if (minAmount > 0 && liveSubtotal < minAmount) {
        setCouponError(`${selectedCode} requires a minimum order amount of ₹${minAmount.toFixed(0)} (current: ₹${liveSubtotal.toFixed(2)}).`);
      } else {
        setCouponError("This offer or coupon is not available for your account.");
      }
      setCouponSuccess("");
      return;
    }

    setLocalPromoCode(selected.code);
    setLocalPromoPercent(parseFloat(selected.discount_percent) / 100);
    setCouponSuccess(`${selected.code} applied: ${selected.discount_percent}% off`);
    setCouponError("");
  };

  // Re-validate applied coupon whenever eligibility changes
  useEffect(() => {
    if (!localPromoCode) return;

    const code = localPromoCode.toUpperCase();
    const stillValid = applicableCoupons.some((c) => c.code.toUpperCase() === code);

    if (!stillValid) {
      setLocalPromoCode("");
      setLocalPromoPercent(0);
      if (code === "RESERVE10" && !couponMeetsMinimum({ code, min_order_amount: RESERVE10_MIN }, liveSubtotal)) {
        setCouponError(`RESERVE10 requires item total of ₹${RESERVE10_MIN} or more. Add more items to use this coupon.`);
      } else {
        const selected = allSelectableCodes.find((c) => c.code.toUpperCase() === code);
        const minAmount = parseFloat(selected?.min_order_amount || 0);
        if (minAmount > 0 && liveSubtotal < minAmount) {
          setCouponError(`${code} requires a minimum order amount of ₹${minAmount.toFixed(0)}. Add more items to use this coupon.`);
        } else if (code.includes("WELCOME") && userOrderCount > 0) {
          setCouponError("Welcome coupon is not applicable for returning customers.");
        } else if (code.includes("RESERVE") && code !== "RESERVE10" && userOrderCount === 0) {
          setCouponError("This reserve coupon is only for returning customers.");
        } else if (usedCouponCodes.includes(code) && code !== "RESERVE10") {
          setCouponError("You have already used this offer or coupon.");
        } else {
          setCouponError("Selected offer or coupon is no longer available.");
        }
      }
      setCouponSuccess("");
    }
  }, [userOrderCount, usedCouponCodes, localPromoCode, applicableCoupons, liveSubtotal, allSelectableCodes]);

  useEffect(() => {
    if (!coinsCanRedeem && useCoinsLocal) {
      setUseCoinsLocal(false);
    }
  }, [coinsCanRedeem, useCoinsLocal]);

  useEffect(() => {
    if (!addressData.deliveryTimeSlot) return;
    const stillAvailable = availableTimeSlots.some(
      (slot) => slot.label === addressData.deliveryTimeSlot
    );
    if (!stillAvailable) {
      setAddressData((prev) => ({ ...prev, deliveryTimeSlot: "" }));
    }
  }, [availableTimeSlots, addressData.deliveryTimeSlot]);

  useEffect(() => {
    if (!syncedPhone) return;
    setAddressData((prev) => ({ ...prev, phone: syncedPhone }));
  }, [syncedPhone]);

  useEffect(() => {
    if (!syncedPhone) return;
    const cleanPhone = syncedPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) return;

    fetch(`/api/user?phone=${cleanPhone}`)
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!data.success) return;
        if (data.wallet) setUserOrderCount(data.wallet.orderCount || 0);
        if (data.usedCouponCodes) setUsedCouponCodes(data.usedCouponCodes.map((c) => c.toUpperCase()));
      })
      .catch((err) => console.error("Error pre-loading coupon eligibility:", err));
  }, [syncedPhone]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    if (cartItems.length === 0 && step < 4 && !confirmedSnapshot && onClose) {
      onClose();
    }
  }, [cartItems.length, step, onClose, confirmedSnapshot]);

  useEffect(() => {
    const scrollToStepTop = () => {
      const el = stepperTopRef.current;
      const navbarOffset = 96;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - navbarOffset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    requestAnimationFrame(scrollToStepTop);
  }, [step]);

  const handleNextStep = () => {
    if (step === 1) {
      const errors = validateStep1();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        scrollToFirstFieldError(errors);
        return;
      }
      setFieldErrors({});
      if (
        addressData.diningMode === "delivery" &&
        hasMapLinkInAddress(addressData.location) &&
        deliveryFeeInfo.withinRadius !== false
      ) {
        persistDefaultAddress(addressData.location);
      }
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    if (step > 1) {
      if (!backOverlayHistory()) {
        setStep((current) => Math.max(1, current - 1));
      }
      return;
    }
    handleLeaveCheckout();
  };

  const getDeliveryDisplayAddress = () => {
    if (addressData.diningMode === "delivery") {
      return addressData.location.split(" || Map: ")[0];
    }
    return `Takeaway — Pickup: ${addressData.tableNo}`;
  };

  const getScheduleDisplay = () =>
    addressData.deliveryDate && addressData.deliveryTimeSlot
      ? `${addressData.deliveryDate} | ${addressData.deliveryTimeSlot}`
      : "—";

  const coinsToEarn = useMemo(() => calculateCoinsEarned(liveSubtotal), [liveSubtotal]);

  const completeOrderSuccess = (orderId, grandTotal, coinsEarned) => {
    setConfirmedSnapshot({
      items: cartItems.map((item) => ({ ...item, selectedAddons: item.selectedAddons ? [...item.selectedAddons] : [] })),
      addressData: { ...addressData },
      subtotal: liveSubtotal,
      coinDiscount: localCoinDiscount,
      promoDiscount: appliedPromoVal,
      promoCode: localPromoCode,
      tax: liveTax,
      packingFee: activePackingFee,
      deliveryFee: activeDeliveryFee,
      grandTotal: grandTotal ?? currentGrandTotal,
      coinsEarned,
      gstPercent,
      restaurantAddress: settings.restaurant_address || "Malkam Cheruvu Kitchen"
    });
    setEarnedCoins(coinsEarned);
    setPaymentStatus("success");
    setStep(4);
    addUserCoins(coinsEarned);
    onOrderSuccess(orderId, grandTotal, addressData.phone);
  };

  const snapshot = confirmedSnapshot;
  const displayItems = snapshot?.items ?? cartItems;
  const displayAddress = snapshot?.addressData ?? addressData;
  const displaySubtotal = snapshot?.subtotal ?? liveSubtotal;
  const displayCoinDiscount = snapshot?.coinDiscount ?? localCoinDiscount;
  const displayPromoDiscount = snapshot?.promoDiscount ?? appliedPromoVal;
  const displayTax = snapshot?.tax ?? liveTax;
  const displayPacking = snapshot?.packingFee ?? activePackingFee;
  const displayDelivery = snapshot?.deliveryFee ?? activeDeliveryFee;
  const displayGrandTotal = snapshot?.grandTotal ?? currentGrandTotal;
  const displayCoinsEarned = snapshot?.coinsEarned ?? earnedCoins ?? coinsToEarn;

  const getSnapshotDeliveryAddress = () => {
    if (displayAddress.diningMode === "delivery") {
      return (displayAddress.location || "").split(" || Map: ")[0] || "—";
    }
    return `Takeaway — Pickup: ${displayAddress.tableNo || "—"}`;
  };

  const getSnapshotSchedule = () =>
    displayAddress.deliveryDate && displayAddress.deliveryTimeSlot
      ? `${displayAddress.deliveryDate} | ${displayAddress.deliveryTimeSlot}`
      : "—";

  const handleLeaveCheckout = () => {
    onClose?.();
  };

  const handleAddMoreItems = (options = {}) => {
    const { reopenOrderSummary = false } = options;
    const cartTotalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    saveCheckoutResumeDraft({
      step,
      addressData,
      orderSummary,
      localPromoCode,
      localPromoPercent,
      useCoinsLocal,
      coinDiscountApplied: Boolean(orderSummary.useCoins || useCoinsLocal),
      cartTotalQty,
      showConfirmModal: reopenOrderSummary,
      awaitResume: true,
      source: checkoutSource,
    });
    if (onAddMoreItems) {
      onAddMoreItems();
      return;
    }
    handleLeaveCheckout();
  };

  const handleAddMoreFromOrderSummary = () => {
    setShowConfirmModal(false);
    handleAddMoreItems({ reopenOrderSummary: true });
  };

  const handleSuccessNavigate = (target) => {
    if (onNavigateAfterSuccess) {
      onNavigateAfterSuccess(target);
      return;
    }
    handleLeaveCheckout();
    if (target === "history" && onViewDashboard) {
      onViewDashboard();
    }
  };

  useEffect(() => {
    if (showConfirmModal) {
      setTermsAccepted(false);
    }
  }, [showConfirmModal]);

  const renderTermsModal = () => {
    if (!showTermsModal) return null;

    return (
      <div className="terms-checkout-modal-overlay" onClick={() => setShowTermsModal(false)}>
        <div className="terms-checkout-modal" onClick={(e) => e.stopPropagation()}>
          <div className="terms-checkout-modal-header">
            <h3>Terms &amp; Conditions</h3>
            <button type="button" className="terms-checkout-modal-close" onClick={() => setShowTermsModal(false)}>
              Close
            </button>
          </div>
          <TermsOfServiceBlock variant="light" compact hideTitle />
        </div>
      </div>
    );
  };

  const renderOrderSummaryModal = () => {
    if (!showConfirmModal) return null;

    return (
      <div
        className="order-summary-modal-overlay"
        onClick={() => setShowConfirmModal(false)}
      >
        <div className="order-summary-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Confirm Your Order</h3>
          <p className="order-summary-subtitle">
            Please review your items, delivery details, and total before proceeding to payment.
          </p>

          <div className="order-summary-section">
            <h4>Items Ordered</h4>
            <div className="order-summary-items">
              {cartItems.map((item, idx) => (
                <div key={idx} className="order-summary-item-row">
                  <SafeImage
                    src={item.image}
                    category={item.category}
                    name={item.name}
                    alt={item.name}
                    className="order-summary-item-thumb"
                  />
                  <div className="order-summary-item-info">
                    <span className="order-summary-item-name">
                      {item.quantity}x {item.name}{item.sizeLabel ? ` (${item.sizeLabel})` : ""}
                    </span>
                    {item.selectedAddons?.length > 0 && (
                      <span className="order-summary-item-addons">
                        + {item.selectedAddons.map((a) => {
                          const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
                          return `${a.name}${qty > 1 ? ` ×${qty}` : ""} (₹${(parseFloat(a.price) * qty).toFixed(0)})`;
                        }).join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="order-summary-item-price">
                    ₹{((item.price + (item.addonsTotal || 0)) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="order-summary-section">
            <h4>{addressData.diningMode === "delivery" ? "Delivery To" : "Pickup Details"}</h4>
            <p className="order-summary-address">{getDeliveryDisplayAddress()}</p>
            <p className="order-summary-meta">
              <strong>Guest:</strong> {addressData.name} · {addressData.phone}
            </p>
            <p className="order-summary-meta">
              <strong>Scheduled:</strong> {getScheduleDisplay()}
            </p>
          </div>

          <div className="order-summary-pricing">
            <div className="order-summary-price-row"><span>Subtotal</span><span>₹{quotedSubtotal.toFixed(2)}</span></div>
            {quotedCoinDiscount > 0 && (
              <div className="order-summary-price-row saving"><span>Coins</span><span>-₹{quotedCoinDiscount.toFixed(2)}</span></div>
            )}
            {quotedPromoDiscount > 0 && (
              <div className="order-summary-price-row saving"><span>Coupon</span><span>-₹{quotedPromoDiscount.toFixed(2)}</span></div>
            )}
            <div className="order-summary-price-row"><span>Tax</span><span>₹{quotedTax.toFixed(2)}</span></div>
            <div className="order-summary-price-row"><span>Packing</span><span>₹{quotedPackingFee.toFixed(2)}</span></div>
            <div className="order-summary-price-row"><span>Delivery{deliveryFeeInfo.distanceKm != null ? ` (${deliveryFeeInfo.distanceKm} km)` : ""}</span><span>₹{quotedDeliveryFee.toFixed(2)}</span></div>
            <div className="order-summary-price-row total"><span>Total</span><span>₹{quotedGrandTotal.toFixed(2)}</span></div>
            {serverTotalsLoading && (
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", textAlign: "right" }}>
                Syncing total with kitchen prices…
              </p>
            )}
            {serverQuoteError && (
              <p style={{ fontSize: "11px", color: "#EF9A9A", marginTop: "8px", textAlign: "right" }}>
                {serverQuoteError}
              </p>
            )}
          </div>

          <div style={{
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingCart size={18} color="var(--accent-gold)" />
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-charcoal)' }}>Craving something more?</p>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Missed an item? Add it now before paying.</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={handleAddMoreFromOrderSummary}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-brand)',
                fontWeight: '600',
                fontSize: '12px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '4px 8px'
              }}
            >
              Add More
            </button>
          </div>

          <div className="order-summary-terms">
            <label className="order-summary-terms-label">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I accept the{" "}
                <button
                  type="button"
                  className="order-summary-terms-link"
                  onClick={() => setShowTermsModal(true)}
                >
                  Terms and Conditions
                </button>
              </span>
            </label>
          </div>

          <div className="order-summary-actions">
            <button type="button" className="btn-secondary btn-compact" onClick={() => setShowConfirmModal(false)}>
              Go Back
            </button>
            <button
              type="button"
              className="btn-primary btn-compact"
              disabled={!termsAccepted || serverTotalsLoading || Boolean(serverQuoteError)}
              onClick={() => {
                if (!termsAccepted) return;
                setShowConfirmModal(false);
                setStep(3);
              }}
            >
              Confirm & Pay
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handlePayment = async () => {
    setPaymentStatus("processing");
    try {
      const orderRes = await fetch("/api/checkout/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItems,
          customerPhone: addressData.phone,
          couponCode: localPromoCode || orderSummary.couponCode,
          useCoins: coinsCanRedeem && (useCoinsLocal || orderSummary.useCoins),
          customerName: addressData.name,
          receiverName: addressData.name,
          receiverPhone: addressData.phone,
          deliveryAddress: addressData.diningMode === "delivery" ? addressData.location : `Takeaway (Pickup: ${addressData.tableNo})`,
          landmark: "",
          pincode: "10022",
          specialInstructions: addressData.specialNotes,
          deliveryDateTime: addressData.deliveryDate + " | " + addressData.deliveryTimeSlot
        })
      });

      const orderText = await orderRes.text();
      let orderData;
      try {
        orderData = JSON.parse(orderText);
      } catch(e) {
        showAlert("Server returned invalid response. Please try again.");
        setPaymentStatus("idle");
        return;
      }
      
      if (!orderData.success) {
        showAlert("Checkout Error: " + orderData.error);
        setPaymentStatus("idle");
        return;
      }

      if (orderData.totals?.grandTotal != null) {
        setServerTotals(orderData.totals);
      }

      if (orderData.isMock) {
        // Show simulated mock gateway
        setMockOrderDetails(orderData);
        setShowMockSimulator(true);
      } else {
        // Load Razorpay Script and open real checkout dialog!
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
          showAlert("Failed to load Razorpay SDK. Please check your internet connection.");
          setPaymentStatus("idle");
          return;
        }

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "THE OH !",
          description: "THE OH Delivery Order",
          order_id: orderData.orderId,
          handler: async function (response) {
            setPaymentStatus("processing");
            try {
              const verifyRes = await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  cartItems: orderData.validatedItems
                })
              });

              const verifyData = await parseJsonResponse(verifyRes);
              if (!verifyData.success) {
                showAlert("Payment Verification Error: " + verifyData.error);
                setPaymentStatus("idle");
                return;
              }

              completeOrderSuccess(orderData.orderId, orderData.totals.grandTotal, orderData.totals.coinsEarned);
            } catch (err) {
              console.error("Verification failed:", err);
              showAlert("Error verifying payment.");
              setPaymentStatus("idle");
            }
          },
          prefill: {
            name: addressData.name,
            contact: addressData.phone
          },
          theme: {
            color: "#0f3020"
          },
          modal: {
            ondismiss: function () {
              setPaymentStatus("idle");
            }
          }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
      }
    } catch (err) {
      console.error(err);
      showAlert("Payment connection error occurred. Please try again.");
      setPaymentStatus("idle");
    }
  };

  const handleSimulateSuccess = async () => {
    setShowMockSimulator(false);
    setPaymentStatus("processing");
    try {
      const verifyRes = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: mockOrderDetails.orderId,
          razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(2, 10).toUpperCase(),
          razorpay_signature: "mock_signature",
          notes: {
            customerName: addressData.name,
            customerPhone: addressData.phone,
            receiverName: addressData.name,
            receiverPhone: addressData.phone,
            deliveryAddress: addressData.diningMode === "delivery" ? addressData.location : `Takeaway (Pickup: ${addressData.tableNo})`,
            landmark: "",
            pincode: "10022",
            specialInstructions: addressData.specialNotes,
            subtotal: mockOrderDetails.totals.subtotal.toString(),
            coinDiscount: mockOrderDetails.totals.coinDiscount.toString(),
            promoDiscount: mockOrderDetails.totals.promoDiscount.toString(),
            tax: mockOrderDetails.totals.tax.toString(),
            packingFee: activePackingFee.toString(),
            deliveryFee: activeDeliveryFee.toString(),
            gstPercent: (gstPercent ?? 8).toString(),
            grandTotal: mockOrderDetails.totals.grandTotal.toString(),
            coinsEarned: mockOrderDetails.totals.coinsEarned.toString(),
            couponCode: localPromoCode || orderSummary.couponCode,
            deliveryDateTime: addressData.deliveryDate + " | " + addressData.deliveryTimeSlot
          },
          cartItems: mockOrderDetails.validatedItems
        })
      });

      const verifyText = await verifyRes.text();
      let verifyData;
      try {
        verifyData = JSON.parse(verifyText);
      } catch(e) {
        showAlert("Server returned invalid response.");
        setPaymentStatus("idle");
        return;
      }

      if (!verifyData.success) {
        showAlert("Payment Verification Error: " + verifyData.error);
        setPaymentStatus("idle");
        return;
      }

      completeOrderSuccess(mockOrderDetails.orderId, mockOrderDetails.totals.grandTotal, mockOrderDetails.totals.coinsEarned);
    } catch (err) {
      console.error(err);
      showAlert("Verification simulation error.");
      setPaymentStatus("idle");
    }
  };

  const openItemDetail = (cartItem, idx) => {
    const fullItem = menuItems.find((m) => Number(m.id) === Number(cartItem.id)) || cartItem;
    setDetailCartIndex(idx);
    setDetailItem(fullItem);
  };

  const getStepProgressWidth = () => {
    switch (step) {
      case 1: return "15%";
      case 2: return "50%";
      case 3: return "85%";
      case 4: return "100%";
      default: return "0%";
    }
  };

  return (
    <div ref={stepperTopRef} className="checkout-stepper-wrapper glass-effect">
      {/* Progress Stepper Bar */}
      <div className="stepper-progress-header">
        <div className="stepper-steps">
          {[
            { label: "Customer Details", icon: <Truck size={14} />, num: 1 },
            { label: "Selections", icon: <ShoppingCart size={14} />, num: 2 },
            { label: "Payment", icon: <CreditCard size={14} />, num: 3 },
            { label: "Enjoy", icon: <Check size={14} />, num: 4 }
          ].map((s) => (
            <div 
              key={s.num} 
              className={`step-indicator ${step >= s.num ? "active" : ""} ${step === s.num ? "current" : ""}`}
            >
              <div className="indicator-icon">
                {step > s.num ? <Check size={12} /> : s.icon}
              </div>
              <span className="indicator-label">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="progress-track-bg">
          <div className="progress-fill-line" style={{ width: getStepProgressWidth() }}></div>
        </div>
      </div>

      {/* Stepper Body */}
      <div className="stepper-body">
        
        {/* STEP 2: REVIEW CART ITEMS */}
        {step === 2 && (
          <div className="stepper-slide">
            <h3 className="stepper-title">Verify Fine Dining Selections</h3>
            <div className="stepper-cart-summary">
              {cartItems.map((item, idx) => (
                <div key={idx} className="checkout-summary-row checkout-summary-row-with-image">
                  <div className="summary-left">
                    <SafeImage
                      src={item.image}
                      category={item.category}
                      name={item.name}
                      alt={item.name}
                      className="checkout-item-thumb"
                    />
                    <span className="qty-tag">{item.quantity}x</span>
                    <div>
                      <p className="item-name">
                        {item.name}{item.sizeLabel ? ` (${item.sizeLabel})` : ""}
                      </p>
                      {item.selectedAddons && item.selectedAddons.length > 0 ? (
                        <p className="addons-subtext">
                          Add-ons: {item.selectedAddons.map((a) => {
                            const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
                            return `${a.name}${qty > 1 ? ` ×${qty}` : ""} (+₹${(parseFloat(a.price) * qty).toFixed(0)})`;
                          }).join(", ")}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="checkout-item-detail-link"
                        onClick={() => openItemDetail(item, idx)}
                      >
                        <ExternalLink size={12} /> View item & add-ons
                      </button>
                    </div>
                  </div>
                  <div className="checkout-item-actions">
                    <span className="item-price">₹{((item.price + (item.addonsTotal || 0)) * item.quantity).toFixed(2)}</span>
                    {onRemoveCartItem && (
                      <button
                        type="button"
                        className="checkout-remove-item-btn"
                        onClick={() => onRemoveCartItem(idx)}
                        title="Remove item"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "20px", textAlign: "left" }}>
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={handleAddMoreItems}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <ShoppingCart size={14} /> Add more items
              </button>
            </div>

            <div className="checkout-math-summary">
              {/* Discounts Section */}
              <div style={{ width: "100%", textAlign: "left", marginBottom: "20px" }}>
                <h5 style={{ color: "var(--accent-gold)", marginBottom: "10px", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px" }}>Discounts & Offers</h5>
                
                {/* Coins Toggle */}
                {availableCoins > 0 && coinsRedemptionSettings.enabled && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: useCoinsLocal && coinsCanRedeem ? "rgba(46, 125, 50, 0.08)" : "rgba(0, 0, 0, 0.02)",
                    border: useCoinsLocal && coinsCanRedeem ? "1px solid #2E7D32" : "1px solid rgba(0,0,0,0.08)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "15px",
                    cursor: coinsCanRedeem ? "pointer" : "default",
                    transition: "all 0.2s",
                    opacity: coinsCanRedeem ? 1 : 0.75
                  }} onClick={() => coinsCanRedeem && setUseCoinsLocal(!useCoinsLocal)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Award size={18} color={useCoinsLocal && coinsCanRedeem ? "#2E7D32" : "var(--accent-gold)"} />
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, margin: 0, color: "var(--text-charcoal)" }}>
                          Use {availableCoins} Coins (₹{availableCoins} off)
                        </p>
                        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                          {coinsCanRedeem
                            ? `1 Coin = ₹1 • You earn ${coinsToEarn} coins (2% of item total)`
                            : `Coins can be used when item total is ₹${coinsRedemptionSettings.minOrderAmount.toFixed(0)} or more (current: ₹${liveSubtotal.toFixed(2)}).`}
                        </p>
                      </div>
                    </div>
                    {coinsCanRedeem && (
                      <div style={{
                        width: "40px", height: "22px",
                        borderRadius: "11px",
                        background: useCoinsLocal ? "#2E7D32" : "rgba(0,0,0,0.15)",
                        position: "relative",
                        transition: "all 0.2s"
                      }}>
                        <div style={{
                          width: "18px", height: "18px",
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: "2px",
                          left: useCoinsLocal ? "20px" : "2px",
                          transition: "all 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                        }} />
                      </div>
                    )}
                  </div>
                )}
                {availableCoins > 0 && !coinsRedemptionSettings.enabled && (
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "15px" }}>
                    Coin redemption is currently disabled by the restaurant.
                  </p>
                )}

                {/* Offer / Coupon picker — inline list (avoids native select overflow on mobile) */}
                <p className="checkout-coupon-label">Coupons</p>
                <div className="checkout-coupon-picker">
                  {addressData.phone.replace(/[^0-9]/g, "").length < 10 ? (
                    <p className="checkout-coupon-empty-msg">
                      Enter phone in Customer Details step to view coupons
                    </p>
                  ) : visibleCoupons.length === 0 ? (
                    <p className="checkout-coupon-empty-msg">
                      No coupons are available for your account.
                    </p>
                  ) : (
                    <div className="checkout-coupon-list" role="listbox" aria-label="Available coupons">
                      <button
                        type="button"
                        role="option"
                        aria-selected={!localPromoCode}
                        className={`checkout-coupon-card checkout-coupon-none${!localPromoCode ? " selected" : ""}`}
                        onClick={() => handleOfferSelect("")}
                      >
                        <span className="checkout-coupon-code">No coupon</span>
                        <span className="checkout-coupon-hint">Continue without a discount code</span>
                      </button>
                      {visibleCoupons.map((coupon) => {
                        const eligible = applicableCoupons.some(
                          (c) => c.code.toUpperCase() === coupon.code.toUpperCase()
                        );
                        const hint = getCouponDropdownHint(coupon);
                        const isSelected =
                          localPromoCode.toUpperCase() === coupon.code.toUpperCase();
                        return (
                          <button
                            type="button"
                            key={coupon.code}
                            role="option"
                            aria-selected={isSelected}
                            disabled={!eligible}
                            className={`checkout-coupon-card${isSelected ? " selected" : ""}${!eligible ? " is-disabled" : ""}`}
                            onClick={() => handleOfferSelect(coupon.code)}
                          >
                            <div className="checkout-coupon-card-head">
                              <span className="checkout-coupon-code">
                                {coupon.label ? `${coupon.label} · ` : ""}
                                {coupon.code}
                              </span>
                              <span className="checkout-coupon-discount">
                                {parseFloat(coupon.discount_percent)}% off
                              </span>
                            </div>
                            <span className="checkout-coupon-hint">{hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {couponSuccess && <p className="checkout-coupon-msg success">{couponSuccess}</p>}
                {couponError && <p className="checkout-coupon-msg error">{couponError}</p>}
              </div>

              <div className="math-row">
                <span>Subtotal</span>
                <span>₹{quotedSubtotal.toFixed(2)}</span>
              </div>
              {quotedCoinDiscount > 0 && (
                <div className="math-row saving">
                  <span>🪙 Coins Redeemed ({Math.min(availableCoins, Math.floor(quotedCoinDiscount))} coins)</span>
                  <span>-₹{quotedCoinDiscount.toFixed(2)}</span>
                </div>
              )}
              {quotedPromoDiscount > 0 && (
                <div className="math-row saving">
                  <span>🎟️ Coupon Deduction ({localPromoCode})</span>
                  <span>-₹{quotedPromoDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="math-row">
                <span>Tax{gstPercent !== null ? ` (${gstPercent}%)` : ""}</span>
                <span>{settingsReady ? `₹${quotedTax.toFixed(2)}` : "—"}</span>
              </div>
              <div className="math-row">
                <span>Packing Fee</span>
                <span>{settingsReady ? `₹${quotedPackingFee.toFixed(2)}` : "—"}</span>
              </div>
              <div className="math-row">
                <span>
                  Delivery Fee
                  {addressData.diningMode === "delivery" && deliveryDistanceLabel
                    ? ` (${deliveryDistanceLabel})`
                    : addressData.diningMode === "delivery"
                    ? " (distance-based)"
                    : " (Excluded)"}
                </span>
                <span>₹{quotedDeliveryFee.toFixed(2)}</span>
              </div>
              <div className="divider"></div>
              <div className="math-row total">
                <span>Total Bill</span>
                <span>{settingsReady && !serverTotalsLoading ? `₹${quotedGrandTotal.toFixed(2)}` : "—"}</span>
              </div>
              {serverTotalsLoading && (
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", textAlign: "right" }}>
                  Syncing total with kitchen prices…
                </p>
              )}
              {serverQuoteError && (
                <p style={{ fontSize: "11px", color: "#EF9A9A", marginTop: "8px", textAlign: "right" }}>
                  {serverQuoteError}
                </p>
              )}
              {!settingsReady && (
                <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", textAlign: "right" }}>
                  Loading fees from kitchen settings…
                </p>
              )}
              {settingsReady && !serverTotalsLoading && (
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", textAlign: "right" }}>🪙 You will earn {coinsToEarn} coins with this order (2% of ₹{quotedSubtotal.toFixed(2)} items)</p>
              )}
            </div>

            <div className="stepper-actions">
              <button className="btn-secondary" onClick={handlePrevStep}>Back</button>
              <button className="btn-primary" onClick={() => setShowConfirmModal(true)} disabled={!settingsReady || serverTotalsLoading || Boolean(serverQuoteError)}>Proceed to Payment</button>
            </div>
          </div>
        )}

        {/* STEP 1: CUSTOMER DETAILS */}
        {step === 1 && (
          <div className="stepper-slide checkout-step-delivery">
            <h3 className="stepper-title">Delivery Details</h3>
            
            <div className="dining-mode-tabs checkout-dining-tabs">
              <button 
                className={`dining-mode-btn ${addressData.diningMode === "delivery" ? "active" : ""}`}
                onClick={() => {
                  setAddressData({...addressData, diningMode: "delivery"});
                  clearFieldError("tableNo");
                }}
              >
                Delivery
              </button>
              <button 
                className={`dining-mode-btn ${addressData.diningMode === "takeaway" ? "active" : ""}`}
                onClick={() => {
                  setAddressData({...addressData, diningMode: "takeaway"});
                  clearFieldError("location");
                }}
              >
                Takeaway
              </button>
            </div>
            
            <div className="checkout-dispatch-block">
              <div className="checkout-dispatch-note">
                {addressData.diningMode === "delivery"
                  ? `Dispatching from: ${getRestaurantLocationLabel(settings)}`
                  : `Permanent Pickup Location: ${getRestaurantLocationLabel(settings)}`}
              </div>
              {addressData.diningMode === "takeaway" && (
                <a
                  href={getRestaurantMapLink(settings)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="checkout-kitchen-map-btn"
                  title="Open THE OH ! cloud kitchen on Google Maps"
                >
                  <MapPin size={16} aria-hidden="true" />
                  Open kitchen map
                </a>
              )}
            </div>

            <div className="input-form-grid">
              <div className="input-group" data-checkout-field="name">
                <label>Guest Name</label>
                <input 
                  type="text" 
                  name="name"
                  autoComplete="name"
                  placeholder="e.g. User"
                  value={addressData.name} 
                  onChange={(e) => {
                    setAddressData({...addressData, name: e.target.value});
                    clearFieldError("name");
                  }}
                  className={inputInvalidClass("name").trim()}
                  required
                  minLength={2}
                />
                {fieldErrors.name && <p className="field-error-msg">{fieldErrors.name}</p>}
              </div>

              <div className="input-group" data-checkout-field="phone">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  name="tel"
                  autoComplete="tel"
                  placeholder="9876543210"
                  value={addressData.phone} 
                  onChange={(e) => {
                    const { value, error, overflow } = applyPhoneInputChange(e.target.value);
                    setAddressData({ ...addressData, phone: value });
                    if (overflow) {
                      setFieldErrors((prev) => ({ ...prev, phone: error }));
                    } else {
                      clearFieldError("phone");
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const { value, error, overflow } = applyPhoneInputChange(
                      e.clipboardData.getData("text")
                    );
                    setAddressData({ ...addressData, phone: value });
                    if (overflow) {
                      setFieldErrors((prev) => ({ ...prev, phone: error }));
                    } else {
                      clearFieldError("phone");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      /^\d$/.test(e.key) &&
                      sanitizePhoneInput(addressData.phone).length >= 10 &&
                      !e.metaKey &&
                      !e.ctrlKey
                    ) {
                      e.preventDefault();
                      setFieldErrors((prev) => ({
                        ...prev,
                        phone: "Phone number must be exactly 10 digits. Extra digits are not allowed.",
                      }));
                    }
                  }}
                  className={inputInvalidClass("phone").trim()}
                  required
                  inputMode="numeric"
                  maxLength={10}
                />
                {fieldErrors.phone && <p className="field-error-msg">{fieldErrors.phone}</p>}
              </div>

              {addressData.diningMode === "delivery" ? (
                <div className="input-group span-2 checkout-address-block" data-checkout-field="location">
                  <label>Residence Address</label>

                  {savedAddresses.filter(hasMapLinkInAddress).length > 1 && (
                    <div className="checkout-saved-address-picker">
                      <span className="saved-address-label">Saved addresses</span>
                      <select
                        name="saved-address"
                        value={savedAddresses.includes(addressData.location) ? addressData.location : ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            setAddressData({ ...addressData, location: e.target.value });
                            clearFieldError("location");
                          }
                        }}
                        className={`checkout-saved-address-select${inputInvalidClass("location")}`}
                      >
                        <option value="">— Select a saved pin —</option>
                        {savedAddresses.filter(hasMapLinkInAddress).map((addr, i) => (
                          <option key={i} value={addr}>{addr.split(" || Map: ")[0]}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <InlineDeliveryMap
                    autoStart={hasPinnedLocation}
                    showSearch
                    interactive
                    value={addressData.location}
                    onChange={(addr) => {
                      setAddressData((prev) => ({ ...prev, location: addr }));
                      clearFieldError("location");
                    }}
                  />

                  {hasPinnedLocation && (
                    <p
                      className="checkout-delivery-fee-note"
                      style={
                        deliveryFeeInfo.withinRadius === false
                          ? { color: "#C62828", fontWeight: 600 }
                          : undefined
                      }
                    >
                      {deliveryFeeLoading
                        ? "Calculating delivery distance..."
                        : deliveryFeeInfo.withinRadius === false
                        ? deliveryRadiusError ||
                          `Delivery is available only within ${deliveryFeeInfo.maxKm ?? deliveryPricing.maxKm ?? 50} km of our kitchen.`
                        : deliveryDistanceLabel
                        ? `Delivery: ₹${deliveryFeeInfo.deliveryFee} (${deliveryDistanceLabel} — ${deliveryPricingLabel}).`
                        : `Delivery fee: ₹${deliveryFeeInfo.deliveryFee}`}
                    </p>
                  )}
                  {fieldErrors.location &&
                    fieldErrors.location !== "__delivery_radius__" && (
                      <p className="field-error-msg">{fieldErrors.location}</p>
                    )}
                </div>
              ) : (
                <div className="input-group span-2" data-checkout-field="tableNo">
                  <label>Preferred Pickup Time</label>
                  <input 
                    type="text" 
                    name="pickup-time"
                    placeholder="e.g. In 15 minutes / 6:30 PM"
                    value={addressData.tableNo} 
                    onChange={(e) => {
                      setAddressData({...addressData, tableNo: e.target.value});
                      clearFieldError("tableNo");
                    }}
                    className={inputInvalidClass("tableNo").trim()}
                    required
                  />
                  {fieldErrors.tableNo && <p className="field-error-msg">{fieldErrors.tableNo}</p>}
                </div>
              )}

              <div className="input-group span-2 checkout-datetime-group" data-checkout-field="deliveryDate">
                <label>Date and Time for Delivery / Pickup</label>
                <div className="checkout-datetime-row">
                  <div
                    className={`checkout-datetime-field${addressData.deliveryDate ? "" : " is-date-empty"}`}
                    data-checkout-field="deliveryDate"
                  >
                    <span className="checkout-datetime-sublabel">Date</span>
                    {!addressData.deliveryDate && (
                      <span className="checkout-date-placeholder" aria-hidden="true">
                        dd/mm/yyyy
                      </span>
                    )}
                    <input
                      type="date"
                      name="delivery-date"
                      className={`checkout-datetime-input${inputInvalidClass("deliveryDate")}`}
                      value={addressData.deliveryDate}
                      onChange={(e) => {
                        const nextDate = e.target.value;
                        if (nextDate && !isOrderDateInRange(nextDate)) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            deliveryDate: "Choose a date within the next 7 days.",
                          }));
                          return;
                        }
                        setAddressData({ ...addressData, deliveryDate: nextDate, deliveryTimeSlot: "" });
                        clearFieldError("deliveryDate");
                        clearFieldError("deliveryTimeSlot");
                      }}
                      min={orderDateBounds.min}
                      max={orderDateBounds.max}
                      required
                      aria-label="Delivery date"
                    />
                  </div>
                  <div className="checkout-datetime-field" data-checkout-field="deliveryTimeSlot">
                    <span className="checkout-datetime-sublabel">Time slot</span>
                    <select
                      name="delivery-time-slot"
                      className={`checkout-datetime-input${inputInvalidClass("deliveryTimeSlot")}`}
                      value={addressData.deliveryTimeSlot}
                      onChange={(e) => {
                        setAddressData({ ...addressData, deliveryTimeSlot: e.target.value });
                        clearFieldError("deliveryTimeSlot");
                      }}
                      required={availableTimeSlots.length > 0}
                    >
                      <option value="">Select time</option>
                      {availableTimeSlots.map((slot) => (
                        <option key={`${slot.startHour}-${slot.label}`} value={slot.label}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {fieldErrors.deliveryDate && <p className="field-error-msg">{fieldErrors.deliveryDate}</p>}
                {fieldErrors.deliveryTimeSlot && <p className="field-error-msg">{fieldErrors.deliveryTimeSlot}</p>}
                {addressData.deliveryDate && availableTimeSlots.length === 0 && (
                  <p className="field-warning-msg">
                    No delivery time slots are available for this date. Choose another date or contact the restaurant.
                  </p>
                )}
              </div>

              <div className="input-group span-2">
                <label>Additional Requests</label>
                <textarea 
                  rows="2"
                  placeholder="e.g. Ensure hygienic packaging. Serve hot."
                  value={addressData.specialNotes} 
                  onChange={(e) => setAddressData({...addressData, specialNotes: e.target.value})}
                />
              </div>
            </div>

            <div className="stepper-actions checkout-step-actions">
              <button className="btn-secondary" onClick={handleLeaveCheckout}>Return to Menu</button>
              <button className="btn-primary" onClick={handleNextStep}>Review Selections <ShoppingCart size={14} /></button>
            </div>
          </div>
        )}

        {/* STEP 3: PAYMENT METHOD (RAZORPAY INTEGRATION) */}
        {step === 3 && (
          <div className="stepper-slide">
            <h3 className="stepper-title">Order Payment Authorization</h3>
            
            {paymentStatus === "processing" ? (
              <div className="payment-processing-overlay">
                <div className="loading-spinner-luxury"></div>
                <h4>Contacting Razorpay Secure Gateway...</h4>
                <p>Authenticating secure dining transaction. Please do not close this window.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 20px", textAlign: "center" }}>
                  <div style={{ marginBottom: "25px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(212, 175, 55, 0.1)", border: "1px solid var(--accent-gold)", padding: "10px 20px", borderRadius: "30px" }}>
                      <ShieldCheck size={18} className="icon-gold" />
                      <span className="text-gold" style={{ fontSize: "0.85rem", fontWeight: "600", letterSpacing: "1px" }}>RAZORPAY SECURE GATEWAY</span>
                    </div>
                  </div>

                  <div style={{ width: "100%", maxWidth: "400px", margin: "0 auto 25px auto", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.95rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Subtotal:</span>
                      <span>₹{liveSubtotal.toFixed(2)}</span>
                    </div>
                    {localCoinDiscount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Loyalty Coins:</span>
                        <span style={{ color: "#4CAF50" }}>-₹{localCoinDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {appliedPromoVal > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Promo Discount:</span>
                        <span style={{ color: "#4CAF50" }}>-₹{appliedPromoVal.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Tax{gstPercent !== null ? ` (${gstPercent}%)` : ""}:</span>
                      <span>{settingsReady ? `₹${liveTax.toFixed(2)}` : "—"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Packing & Delivery:</span>
                      <span>{settingsReady ? `₹${(activePackingFee + activeDeliveryFee).toFixed(2)}` : "—"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.3rem", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed rgba(255,255,255,0.2)" }}>
                      <span>Total Bill:</span>
                      <strong className="text-gold price-text">{settingsReady ? `₹${currentGrandTotal.toFixed(2)}` : "—"}</strong>
                    </div>
                  </div>

                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "350px", marginBottom: "30px", lineHeight: "1.6" }}>
                    Your dining request will be confirmed instantly upon authorization. You can choose to pay via Cards, UPI, Netbanking, or Wallet.
                  </p>

                  <div className="stepper-actions stepper-actions-payment">
                    <button type="button" className="btn-secondary btn-compact" onClick={handleAddMoreItems}>
                      <ShoppingCart size={14} /> Add more items
                    </button>
                    <button type="button" className="btn-secondary btn-compact" onClick={handlePrevStep}>Back</button>
                    <button type="button" className="btn-primary btn-compact" onClick={handlePayment} disabled={!settingsReady}>
                      Pay with Razorpay <CreditCard size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 4: ENJOY — ORDER CONFIRMED */}
        {step === 4 && snapshot && (
          <div className="stepper-slide success-slide">
            <div className="success-lottie-check">
              <div className="checkmark-ring"></div>
              <Check size={28} className="checkmark-icon" />
            </div>

            <h3 className="success-title">Payment Successful</h3>
            <p className="success-subtitle">Your order is confirmed. Here are your details.</p>

            <div className="enjoy-order-block">
              <h4 className="enjoy-block-title">Items Ordered</h4>
              <div className="enjoy-items-list">
                {displayItems.map((item, idx) => (
                  <div key={idx} className="enjoy-item-row">
                    <SafeImage
                      src={item.image}
                      category={item.category}
                      name={item.name}
                      alt={item.name}
                      className="enjoy-item-thumb"
                    />
                    <div className="enjoy-item-info">
                      <span className="enjoy-item-name">
                        {item.quantity}x {item.name}{item.sizeLabel ? ` (${item.sizeLabel})` : ""}
                      </span>
                      {item.selectedAddons?.length > 0 && (
                        <span className="enjoy-item-addons">
                          + {item.selectedAddons.map((a) => {
                          const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
                          return `${a.name}${qty > 1 ? ` ×${qty}` : ""} (₹${(parseFloat(a.price) * qty).toFixed(0)})`;
                        }).join(", ")}
                        </span>
                      )}
                    </div>
                    <span className="enjoy-item-price">
                      ₹{((item.price + (item.addonsTotal || 0)) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="success-receipt-card">
              <h4 className="enjoy-block-title" style={{ marginBottom: "12px" }}>Delivery & Guest</h4>
              <div className="receipt-row">
                <span>Guest</span>
                <span>{displayAddress.name}</span>
              </div>
              <div className="receipt-row">
                <span>Phone</span>
                <span>{displayAddress.phone}</span>
              </div>
              <div className="receipt-row">
                <span>{displayAddress.diningMode === "delivery" ? "Deliver To" : "Pickup"}</span>
                <span>{getSnapshotDeliveryAddress()}</span>
              </div>
              <div className="receipt-row">
                <span>Scheduled</span>
                <span>{getSnapshotSchedule()}</span>
              </div>

              <div className="receipt-divider" />

              <h4 className="enjoy-block-title" style={{ marginBottom: "12px" }}>Payment Summary</h4>
              <div className="receipt-row">
                <span>Subtotal</span>
                <span>₹{displaySubtotal.toFixed(2)}</span>
              </div>
              {displayCoinDiscount > 0 && (
                <div className="receipt-row">
                  <span>Coins Redeemed</span>
                  <span>-₹{displayCoinDiscount.toFixed(2)}</span>
                </div>
              )}
              {displayPromoDiscount > 0 && (
                <div className="receipt-row">
                  <span>Coupon{snapshot.promoCode ? ` (${snapshot.promoCode})` : ""}</span>
                  <span>-₹{displayPromoDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="receipt-row">
                <span>Tax{snapshot.gstPercent != null ? ` (${snapshot.gstPercent}%)` : ""}</span>
                <span>₹{displayTax.toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Packing Fee</span>
                <span>₹{displayPacking.toFixed(2)}</span>
              </div>
              {displayAddress.diningMode === "delivery" && (
                <div className="receipt-row">
                  <span>
                    Delivery Fee
                    {deliveryFeeInfo.distanceKm != null ? ` (${deliveryFeeInfo.distanceKm} km)` : ""}
                  </span>
                  <span>₹{displayDelivery.toFixed(2)}</span>
                </div>
              )}
              <div className="receipt-row receipt-row-total">
                <span>Total Paid</span>
                <span>₹{displayGrandTotal.toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Payment</span>
                <span>Paid via Razorpay</span>
              </div>
              <div className="receipt-divider" />
              <div className="receipt-loyalty-earn">
                <Award size={16} className="icon-gold" />
                <div>
                  <p className="reward-title">Coins Earned</p>
                  <p className="reward-desc">+{displayCoinsEarned} Reserve coins credited to your account</p>
                </div>
              </div>
            </div>

            {displayAddress.diningMode === "delivery" && getDeliveryRouteMapEmbedUrl(displayAddress.location) && (
              <div className="enjoy-route-block">
                <h4 className="enjoy-block-title">Delivery Route</h4>
                <p className="enjoy-route-caption">
                  Shortest two-wheeler route from {snapshot.restaurantAddress} to your location
                </p>
                <div className="enjoy-route-map delivery-route-map">
                  <iframe
                    title="Delivery route map"
                    src={getDeliveryRouteMapEmbedUrl(displayAddress.location)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={getDeliveryRouteMapLink(displayAddress.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="enjoy-route-link"
                >
                  Open in Maps
                </a>
              </div>
            )}

            <div className="enjoy-actions">
              <button type="button" className="btn-primary btn-compact enjoy-nav-btn" onClick={() => handleSuccessNavigate("menu")}>
                Back to Menu
              </button>
              <button
                type="button"
                className="btn-secondary btn-compact enjoy-nav-btn enjoy-secondary-btn"
                onClick={() => handleSuccessNavigate("history")}
              >
                View Order History
              </button>
            </div>
          </div>
        )}

        {/* MOCK PAYMENT SIMULATOR MODAL */}
        {showMockSimulator && mockOrderDetails && (
          <div className="details-overlay-backdrop" style={{ zIndex: 1100, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div className="form-modal-box glass-dark-effect" style={{ maxWidth: "450px", textAlign: "center", border: "1px solid var(--accent-gold)", padding: "30px", borderRadius: "12px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "15px" }}>
                <div style={{ padding: "10px", borderRadius: "50%", background: "rgba(212, 175, 55, 0.1)", border: "1px solid var(--accent-gold)" }}>
                  <ShieldCheck size={28} className="icon-gold" />
                </div>
              </div>
              
              <h3 style={{ fontFamily: "Cinzel, serif", fontSize: "1.3rem", color: "#fff", marginBottom: "5px" }}>
                Razorpay Payment Simulator
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "20px" }}>
                Development environment fallback mode
              </p>

              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "15px", marginBottom: "20px", textAlign: "left", fontSize: "0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Grand Total</span>
                  <span className="text-gold price-text" style={{ fontWeight: "bold" }}>₹{mockOrderDetails.totals.grandTotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Currency</span>
                  <span style={{ color: "#fff" }}>INR (₹)</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button 
                  className="btn-primary" 
                  style={{ width: "100%", justifyContent: "center", background: "var(--accent-gold)", color: "#000" }} 
                  onClick={handleSimulateSuccess}
                >
                  Authorize Payment (Success)
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ width: "100%", justifyContent: "center" }} 
                  onClick={() => {
                    setShowMockSimulator(false);
                    setPaymentStatus("idle");
                  }}
                >
                  Cancel Transaction
                </button>
              </div>
            </div>
          </div>
        )}

      {renderOrderSummaryModal()}
      {renderTermsModal()}

      {detailItem && (
        <ProductDetailsModal
          item={detailItem}
          cartLine={detailCartIndex != null ? cartItems[detailCartIndex] : null}
          manageHistory={false}
          onClose={() => {
            setDetailItem(null);
            setDetailCartIndex(null);
          }}
          onAddToCart={onAddToCart ? (item) => {
            onAddToCart(item);
            setDetailItem(null);
            setDetailCartIndex(null);
            setCouponSuccess("Item added to your order — total updated.");
            setTimeout(() => setCouponSuccess((prev) => (prev === "Item added to your order — total updated." ? "" : prev)), 2500);
          } : () => {
            setDetailItem(null);
            setDetailCartIndex(null);
          }}
          onUpdateCartLine={
            detailCartIndex != null && onUpdateCartItem
              ? (updated) => {
                  onUpdateCartItem(detailCartIndex, updated);
                  setDetailItem(null);
                  setDetailCartIndex(null);
                  setCouponSuccess("Item updated with add-ons — total recalculated.");
                  setTimeout(() => setCouponSuccess((prev) => (prev === "Item updated with add-ons — total recalculated." ? "" : prev)), 2500);
                }
              : null
          }
        />
      )}

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
    </div>
  );
}
