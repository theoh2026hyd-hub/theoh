"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Package, MapPin, Phone, Mail, User, Building2, LogOut } from "lucide-react";
import LocationVerifierModal from "./LocationVerifierModal";
import InlineDeliveryMap from "./InlineDeliveryMap";
import OrderDetailsModal from "./OrderDetailsModal";
import UserAuthPanel from "./UserAuthPanel";
import PhoneRequiredModal from "./PhoneRequiredModal";
import { ContactPhoneIconLink, ContactInstagramIconLink } from "./ContactIconLinks";
import { createClient } from "@/app/lib/supabase/browser";
import { clearUserSessionStorage, notifySessionCleared, readUserCart, writeUserCart } from "@/app/lib/userSessionStorage";
import { getOrderDisplayId } from "../lib/orderNumber";
import { normalizeProfileAddress } from "../lib/profileAddress";
import { hasMapLinkInAddress } from "../lib/delivery";
import { CONTACT_EMAIL, getPublicContactLocationLabel, getPublicContactMapLink } from "../lib/contactInfo";
import { isActiveOrderStatus, isPreviousOrderStatus, isDeliveredOrderStatus } from "../lib/orderStatus";
import { repeatOrderItemsToCart } from "../lib/repeatOrder";
import { notifyCartUpdate } from "./CartFloatingBar";
import LoadingButton from "./LoadingButton";
import { useAuth } from "../hooks/useAuth";
import { isValidPhone, sanitizePhoneInput, applyPhoneInputChange, getPhoneValidationError, PHONE_EXACT_LENGTH_ERROR } from "@/app/lib/phone";
import { parseJsonResponse } from "../lib/fetchJson";

function getDisplayAddress(addr) {
  return normalizeProfileAddress(addr);
}

export default function UserDashboard({ userCoins, orderHistory, onFetchProfile, activePhone }) {
  const router = useRouter();
  const { refreshAuth, clearNeedsPhone } = useAuth();
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState("");
  const [syncedProfile, setSyncedProfile] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLocationVerifierOpen, setIsLocationVerifierOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deskSettings, setDeskSettings] = useState(null);
  const [deskSettingsLoading, setDeskSettingsLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [menuReady, setMenuReady] = useState(false);
  const [repeatOrderId, setRepeatOrderId] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [saveAddressLoading, setSaveAddressLoading] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadMenuDesk = () => {
      fetch("/api/menu", { cache: "no-store" })
        .then((res) => parseJsonResponse(res))
        .then((data) => {
          if (cancelled) return;
          if (data.success && data.settings) {
            setDeskSettings(data.settings);
          }
          if (data.success && Array.isArray(data.menu)) {
            setMenuItems(data.menu);
          }
        })
        .catch((err) => console.error("Failed to load desk settings:", err))
        .finally(() => {
          if (!cancelled) {
            setDeskSettingsLoading(false);
            setMenuReady(true);
          }
        });
    };

    loadMenuDesk();

    const handleMenuBust = () => {
      loadMenuDesk();
    };
    const handleStorage = (event) => {
      if (event.key === "theoh_menu_cache_bust" && event.newValue) {
        loadMenuDesk();
      }
    };

    window.addEventListener("theoh-menu-cache-bust", handleMenuBust);
    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("theoh-menu-cache-bust", handleMenuBust);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const onFetchProfileRef = useRef(onFetchProfile);
  onFetchProfileRef.current = onFetchProfile;

  const validateRegisteredSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/validate-session", {
        method: "POST",
        cache: "no-store",
      });
      return parseJsonResponse(res);
    } catch (err) {
      console.warn("Failed to validate session in UserDashboard:", err?.message || err);
      return { success: false, error: err?.message || "Session validation failed." };
    }
  }, []);

  const signOutIfUnregistered = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthUser(null);
    setSyncedProfile(null);
    setPhoneInput("");
    setEditName("");
    setEditAddress("");
    setPhoneModalOpen(false);
    clearUserSessionStorage();
    notifySessionCleared();
  }, []);

  const loadAuthenticatedProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setSyncedProfile({
          customerName: data.wallet.customerName,
          deliveryAddress: data.wallet.deliveryAddress,
          phone: data.wallet.phone,
          email: data.wallet.email,
          fullName: data.wallet.fullName,
          authProvider: data.wallet.authProvider,
        });
        setEditName(data.wallet.customerName || data.wallet.fullName || "User");
        if (data.wallet.phone) {
          setPhoneInput(data.wallet.phone);
          if (typeof window !== "undefined") {
            localStorage.setItem("theoh_phone", data.wallet.phone);
          }
        }
        if (onFetchProfileRef.current) {
          onFetchProfileRef.current(
            data.wallet.balance,
            data.orders || [],
            data.wallet.phone,
            data.wallet.favorites
          );
        }
        return data;
      }

      if (data.code === "NOT_REGISTERED") {
        await signOutIfUnregistered();
      }
    } catch (err) {
      console.error("Authenticated profile load error:", err);
    }
    return null;
  }, [signOutIfUnregistered]);

  useEffect(() => {
    const supabase = createClient();

    const initAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setAuthUser(user);
      setAuthLoading(false);

      if (user) {
        const sessionData = await validateRegisteredSession();
        if (!sessionData.success || !sessionData.registered) {
          await signOutIfUnregistered();
          return;
        }

        if (sessionData.needsPhone) {
          setPhoneModalOpen(true);
          return;
        }

        await loadAuthenticatedProfile();
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      if (nextUser) {
        const sessionData = await validateRegisteredSession();
        if (!sessionData.success || !sessionData.registered) {
          await signOutIfUnregistered();
          return;
        }
        if (sessionData.needsPhone) {
          setPhoneModalOpen(true);
        }
      }
      setAuthUser(nextUser);
    });

    return () => subscription.unsubscribe();
  }, [loadAuthenticatedProfile, signOutIfUnregistered, validateRegisteredSession]);

  const handleAuthenticated = async (_user, options = {}) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setAuthUser(user);
    if (user) {
      const sessionData = await validateRegisteredSession();
      if (!sessionData.success || !sessionData.registered) {
        await signOutIfUnregistered();
        return;
      }
      if (options.needsPhone || sessionData.needsPhone) {
        setPhoneModalOpen(true);
        return;
      }
      await loadAuthenticatedProfile();
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthUser(null);
    setSyncedProfile(null);
    setPhoneInput("");
    setEditName("");
    setEditAddress("");
    setErrorMsg("");
    setSuccessMsg("");
    setPhoneModalOpen(false);
    clearUserSessionStorage();
    notifySessionCleared();
  };

  const syncProfile = useCallback(async (phone) => {
    const active = (phone || "").trim();
    if (!active) return null;
    try {
      const res = await fetch(`/api/user?phone=${encodeURIComponent(active)}`);
      const data = await parseJsonResponse(res);
      if (data.success) {
        setSyncedProfile({
          customerName: data.wallet.customerName,
          deliveryAddress: data.wallet.deliveryAddress,
          phone: data.wallet.phone
        });
        setEditName(data.wallet.customerName || "User");
        if (onFetchProfileRef.current) {
          onFetchProfileRef.current(
            data.wallet.balance,
            data.orders || [],
            active,
            data.wallet.favorites
          );
        }
        return data;
      }
    } catch (err) {
      console.error("Profile sync error:", err);
    }
    return null;
  }, []);

  const hasActiveOrders = (Array.isArray(orderHistory) ? orderHistory : []).some((order) =>
    isActiveOrderStatus(order.status)
  );

  useEffect(() => {
    if (authLoading || authUser) return;

    const storedPhone = activePhone || (typeof window !== "undefined" ? localStorage.getItem("theoh_phone") : null);
    const active = storedPhone || "";
    setPhoneInput(active);
    if (!active) return;

    syncProfile(active);

    if (!hasActiveOrders) return undefined;

    const interval = setInterval(() => syncProfile(active), 60000);
    return () => clearInterval(interval);
  }, [authUser, authLoading, activePhone, hasActiveOrders, syncProfile]);

  useEffect(() => {
    if (!authUser || !hasActiveOrders) return undefined;

    const interval = setInterval(() => {
      loadAuthenticatedProfile();
    }, 60000);
    return () => clearInterval(interval);
  }, [authUser, hasActiveOrders, loadAuthenticatedProfile]);

  // Edit profile state variables
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const handleStartEditProfile = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setPhoneInput(syncedProfile?.phone || "");
    setEditName(syncedProfile?.customerName || syncedProfile?.fullName || "");
    setErrorMsg("");
    setSuccessMsg("");
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (syncLoading) return;
    setErrorMsg("");
    setSuccessMsg("");

    const digits = sanitizePhoneInput(phoneInput);
    const validationError = getPhoneValidationError(digits);
    if (validationError || !isValidPhone(digits)) {
      setErrorMsg(validationError || "Enter a valid 10-digit phone number.");
      return;
    }

    if (!editName.trim()) {
      setErrorMsg("Please enter your name.");
      return;
    }

    const phoneToSave = digits;
    setSyncLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneToSave,
          customerName: editName.trim(),
        }),
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        await loadAuthenticatedProfile();
        setIsEditingProfile(false);
        setSuccessMsg("Profile updated successfully.");
        if (onFetchProfile) {
          onFetchProfile(userCoins, orderHistory, phoneToSave);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("theoh_phone", phoneToSave);
        }
      } else {
        setErrorMsg(data.error || "Failed to save profile.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Connection failure while saving profile.");
    } finally {
      setSyncLoading(false);
    }
  };

  const getPhoneToSave = () => (phoneInput || syncedProfile?.phone || "").trim();

  const validatePhone = (phoneToSave) => isValidPhone(phoneToSave);

  const handleSaveAddress = async () => {
    if (saveAddressLoading) return;
    setErrorMsg("");
    setSuccessMsg("");

    const phoneToSave = getPhoneToSave();
    if (!validatePhone(phoneToSave)) {
      setErrorMsg("Enter a valid phone number and save your profile details first.");
      return;
    }

    if (!editAddress.trim() || !hasMapLinkInAddress(editAddress)) {
      setErrorMsg("Please pin your delivery location on the map.");
      return;
    }

    const customerName = editName.trim() || syncedProfile?.customerName || "User";

    setSaveAddressLoading(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneToSave,
          customerName,
          deliveryAddress: editAddress.trim()
        })
      });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setPhoneInput(phoneToSave);
        setSyncedProfile({
          customerName,
          deliveryAddress: editAddress.trim(),
          phone: phoneToSave
        });
        setSuccessMsg("Delivery address saved successfully!");
        if (onFetchProfile) {
          onFetchProfile(userCoins, orderHistory, phoneToSave);
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("theoh_phone", phoneToSave);
        }
      } else {
        setErrorMsg(data.error || "Failed to update delivery address.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Connection failure during profile update.");
    } finally {
      setSaveAddressLoading(false);
    }
  };

  const formatAddressForDisplay = (addr) => {
    if (!addr) return "";
    if (addr.includes(" || Map: ")) {
      return addr.split(" || Map: ")[0];
    }
    return addr;
  };

  const getMapLink = (addr) => {
    if (!addr) return null;
    if (addr.includes(" || Map: ")) {
      return addr.split(" || Map: ")[1];
    }
    return null;
  };

  const getEmbedUrl = (addr) => {
    if (!addr) return "";
    let searchStr = addr;
    if (addr.includes(" || Map: ")) {
      const parts = addr.split(" || Map: ");
      const mapLink = parts[1];
      const match = mapLink.match(/query=([^&]+)/);
      if (match) {
        searchStr = match[1];
      } else {
        searchStr = parts[0];
      }
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(searchStr)}&z=15&output=embed`;
  };

  const savedDeliveryAddress = syncedProfile?.deliveryAddress || "";
  const isAddressDirty = editAddress !== savedDeliveryAddress;

  useEffect(() => {
    setEditAddress(savedDeliveryAddress);
  }, [savedDeliveryAddress]);

  const displayHistory = Array.isArray(orderHistory) ? orderHistory : [];
  const activeOrders = displayHistory.filter((order) => isActiveOrderStatus(order.status));
  const previousOrders = displayHistory.filter((order) => isPreviousOrderStatus(order.status));
  const hasAccessedSuite =
    Boolean(authUser) ||
    Boolean(syncedProfile || isValidPhone(phoneInput));

  const orderHasFullBreakdown = (order) =>
    Array.isArray(order?.itemsList) &&
    order.itemsList.length > 0 &&
    order.itemsList.some((item) => parseFloat(item.price || 0) > 0) &&
    parseFloat(order.subtotal || 0) > 0;

  const openOrderDetails = async (order) => {
    if (!orderHasFullBreakdown(order) && phoneInput.trim()) {
      const data = await syncProfile(phoneInput);
      const refreshed = data?.orders?.find((entry) => entry.id === order.id);
      setSelectedOrder(refreshed || order);
      return;
    }
    setSelectedOrder(order);
  };

  const loadMenuItems = async () => {
    try {
      const res = await fetch("/api/menu", { cache: "no-store" });
      const data = await parseJsonResponse(res);
      if (data.success && Array.isArray(data.menu)) {
        setMenuItems(data.menu);
        setMenuReady(true);
        return data.menu;
      }
    } catch (err) {
      console.error("Failed to load menu for repeat order:", err);
    }
    return [];
  };

  const handleRepeatOrder = async (order) => {
    setErrorMsg("");
    setSuccessMsg("");
    setRepeatOrderId(order.id);

    try {
      const phone = (phoneInput || syncedProfile?.phone || activePhone || "").trim();
      let orderToRepeat = order;

      if (phone) {
        const data = await syncProfile(phone);
        const refreshed = data?.orders?.find((entry) => entry.id === order.id);
        if (refreshed) {
          orderToRepeat = refreshed;
        }
      } else if (!orderHasFullBreakdown(order)) {
        setErrorMsg("Access your profile with your phone number before repeating an order.");
        return;
      }

      const menu = menuReady && menuItems.length ? menuItems : await loadMenuItems();
      if (!menu.length) {
        setErrorMsg("Menu unavailable. Please try again.");
        return;
      }

      const existingCart = authUser?.id ? readUserCart(authUser.id) : [];
      const result = repeatOrderItemsToCart(orderToRepeat, menu, existingCart);

      if (result.added === 0) {
        setErrorMsg(
          result.warnings.join(" ") || "Could not add items from this order to your cart."
        );
        return;
      }

      if (authUser?.id) {
        writeUserCart(authUser.id, result.cart);
        notifyCartUpdate();
      }

      setSelectedOrder(null);
      router.push("/cart");
    } catch (err) {
      console.error("Repeat order failed:", err);
      setErrorMsg("Could not repeat this order. Please try again.");
    } finally {
      setRepeatOrderId(null);
    }
  };

  const renderOrderRow = (order, idx, showRepeat = false) => (
    <div key={order.id || idx} className="order-row">
      <span className="order-id">{getOrderDisplayId(order) || "Confirmed"}</span>
      <span className="order-date">{order.date}</span>
      <span className="order-items" title={order.items}>{order.items}</span>
      <span className="order-total">₹{Number(order.total || order.grandTotal || 0).toFixed(2)}</span>
      <span className={`order-status ${order.statusClass || "processing"}`}>
        <span className="status-dot"></span> {order.status || "Pending"}
      </span>
      <div className="order-row-actions">
        <button
          type="button"
          className="order-details-btn"
          onClick={() => openOrderDetails(order)}
        >
          View Details
        </button>
        {showRepeat && isDeliveredOrderStatus(order.status) && (
          <LoadingButton
            type="button"
            className="order-repeat-btn"
            onClick={() => handleRepeatOrder(order)}
            loading={repeatOrderId === order.id}
            loadingText="Adding…"
          >
            Repeat Order
          </LoadingButton>
        )}
      </div>
    </div>
  );

  const renderOrdersSection = (title, orders, emptyTitle, emptyDesc, showRepeat = false) => (
    <div className="orders-section-block">
      <h5 className="orders-section-title">{title}</h5>
      {orders.length > 0 && (
        <div className="orders-table-header">
          <span>Order</span>
          <span>Date</span>
          <span>Selections</span>
          <span>Total Bill</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
      )}
      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="orders-empty-state orders-empty-state-compact">
            <p className="orders-empty-title">{emptyTitle}</p>
            <p className="orders-empty-desc">{emptyDesc}</p>
          </div>
        ) : (
          orders.map((order, idx) => renderOrderRow(order, idx, showRepeat))
        )}
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="dashboard-wrapper">
        <div className="dashboard-header">
          <span className="dashboard-subtitle">MY ACCOUNT</span>
          <h2 className="dashboard-title">Loading your profile…</h2>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <UserAuthPanel onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-header">
        <span className="dashboard-subtitle">MY ACCOUNT</span>
        <h2 className="dashboard-title">
          {syncedProfile ? `Welcome back, ${syncedProfile.customerName}` : "Your THE OH ! Profile"}
        </h2>
        <p className="dashboard-welcome">Manage your account details, delivery address, and order history.</p>
        <div className="dashboard-auth-bar">
          <button type="button" className="dashboard-signout-btn" onClick={handleSignOut}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid-profile">
        <div className="dashboard-profile-left">
          {/* User Information */}
          <div className="dashboard-card dashboard-card-fit dashboard-profile-user-card glass-effect">
            <div className="card-header-icon card-header-icon-compact">
              <User size={20} className="icon-primary" />
              <h4>User Information</h4>
            </div>
            <div className="dashboard-user-info-fields">
              <div className="dashboard-field-group">
                <label className="dashboard-field-label" htmlFor="profile-user-email">
                  Email
                </label>
                <div className="dashboard-input-readonly">
                  <Mail size={16} aria-hidden="true" />
                  <span id="profile-user-email">
                    {syncedProfile?.email || authUser?.email || "Not available"}
                  </span>
                </div>
              </div>
              <div className="dashboard-field-group">
                <label className="dashboard-field-label" htmlFor="profile-user-phone">
                  Phone Number
                </label>
                <input
                  id="profile-user-phone"
                  type="tel"
                  className={`dashboard-input dashboard-input-full${!isEditingProfile ? " dashboard-input-locked" : ""}`}
                  placeholder="9876543210"
                  value={phoneInput}
                  onChange={(e) => {
                    const { value, error, overflow } = applyPhoneInputChange(e.target.value);
                    setPhoneInput(value);
                    if (overflow) setErrorMsg(error);
                    else if (errorMsg === PHONE_EXACT_LENGTH_ERROR) setErrorMsg("");
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const { value, error, overflow } = applyPhoneInputChange(
                      e.clipboardData.getData("text")
                    );
                    setPhoneInput(value);
                    if (overflow) setErrorMsg(error);
                    else if (errorMsg === PHONE_EXACT_LENGTH_ERROR) setErrorMsg("");
                  }}
                  onKeyDown={(e) => {
                    if (
                      /^\d$/.test(e.key) &&
                      phoneInput.length >= 10 &&
                      !e.metaKey &&
                      !e.ctrlKey
                    ) {
                      e.preventDefault();
                      setErrorMsg(PHONE_EXACT_LENGTH_ERROR);
                    }
                  }}
                  disabled={!isEditingProfile || syncLoading}
                  readOnly={!isEditingProfile}
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                />
              </div>
              <div className="dashboard-field-group">
                <label className="dashboard-field-label" htmlFor="profile-user-name">
                  User Name
                </label>
                <input
                  id="profile-user-name"
                  type="text"
                  className={`dashboard-input dashboard-input-full${!isEditingProfile ? " dashboard-input-locked" : ""}`}
                  placeholder="Your name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  minLength={2}
                  disabled={!isEditingProfile || syncLoading}
                  readOnly={!isEditingProfile}
                />
              </div>
              {errorMsg && <p className="dashboard-msg dashboard-msg-error">{errorMsg}</p>}
              {successMsg && <p className="dashboard-msg dashboard-msg-success">{successMsg}</p>}
              <div className="dashboard-profile-actions">
                {!isEditingProfile ? (
                  <LoadingButton
                    type="button"
                    onClick={handleStartEditProfile}
                    className="user-panel-btn dashboard-action-btn dashboard-save-profile-btn"
                  >
                    Update
                  </LoadingButton>
                ) : (
                  <div className="dashboard-profile-actions dashboard-profile-actions-row">
                    <LoadingButton
                      type="button"
                      onClick={handleSaveProfile}
                      className="user-panel-btn dashboard-action-btn dashboard-action-btn-half"
                      loading={syncLoading}
                      loadingText="Saving…"
                    >
                      Save
                    </LoadingButton>
                    <button
                      type="button"
                      onClick={handleCancelEditProfile}
                      className="dashboard-action-btn dashboard-action-btn-secondary dashboard-action-btn-half"
                      disabled={syncLoading}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Us */}
          <div className="dashboard-card dashboard-card-fit dashboard-contact-card glass-effect">
            <div className="card-header-icon card-header-icon-compact">
              <Phone size={20} className="icon-primary" />
              <h4>Contact Us</h4>
            </div>
            <div className="address-content" style={{ position: "relative", minHeight: "160px" }}>
              {deskSettingsLoading ? (
                <div className="section-loading-inline">
                  <div className="loading-spinner-luxury section-loading-spinner" aria-hidden="true" />
                </div>
              ) : deskSettings ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#444" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <Building2 size={14} style={{ marginTop: "2px", flexShrink: 0, color: "var(--primary-brand)" }} />
                      <div>
                        <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#666", marginBottom: "2px" }}>
                          Business Name
                        </span>
                        <span style={{ color: "#111" }}>The OH ! (Oats Habit)</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <ContactPhoneIconLink
                        phone={deskSettings?.restaurant_phone}
                        className="dashboard-contact-icon-link"
                        size={14}
                      />
                      <ContactInstagramIconLink
                        className="dashboard-contact-icon-link"
                        size={14}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <Mail size={14} style={{ marginTop: "2px", flexShrink: 0, color: "var(--primary-brand)" }} />
                      <a
                        href={`mailto:${deskSettings?.restaurant_email || CONTACT_EMAIL}`}
                        style={{ color: "#111", textDecoration: "none" }}
                      >
                        {deskSettings?.restaurant_email || CONTACT_EMAIL}
                      </a>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <MapPin size={14} style={{ marginTop: "2px", flexShrink: 0, color: "var(--primary-brand)" }} />
                      <a
                        href={getPublicContactMapLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#111", textDecoration: "none" }}
                        title={`View ${getPublicContactLocationLabel(deskSettings)} on Google Maps`}
                      >
                        {getPublicContactLocationLabel(deskSettings)}
                      </a>
                    </div>
                  </div>
                  {(deskSettings.open_time || deskSettings.close_time) && (
                    <p style={{ fontSize: "12px", color: "#666", marginTop: "12px", marginBottom: 0 }}>
                      Hours: {deskSettings.open_time || "Not available"} to {deskSettings.close_time || "Not available"}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>Contact details are temporarily unavailable.</p>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Address — right column, full height */}
        <div className="dashboard-card dashboard-card-fit address-card dashboard-profile-address glass-effect">
          <div className="card-header-icon card-header-icon-compact">
            <MapPin size={20} className="icon-primary" />
            <h4>My Delivery Address</h4>
          </div>

          <div className="address-content dashboard-profile-address-body">
            <p className="resident-address dashboard-address-status">
              {getDisplayAddress(editAddress)
                ? formatAddressForDisplay(editAddress)
                : "Not added"}
            </p>

            <InlineDeliveryMap
              autoStart
              showSearch
              interactive
              value={editAddress}
              onChange={setEditAddress}
            />

            {getMapLink(editAddress) && !isAddressDirty && (
              <a
                href={getMapLink(editAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="dashboard-address-maps-link"
              >
                Open in Google Maps
              </a>
            )}

            {isAddressDirty ? (
              <div className="dashboard-profile-actions dashboard-profile-actions-row">
                <LoadingButton
                  onClick={handleSaveAddress}
                  className="user-panel-btn dashboard-action-btn dashboard-action-btn-half"
                  loading={saveAddressLoading}
                  loadingText="Saving…"
                >
                  Save Address
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => {
                    setEditAddress(savedDeliveryAddress);
                    setErrorMsg("");
                  }}
                  className="dashboard-action-btn dashboard-action-btn-secondary dashboard-action-btn-half"
                  disabled={saveAddressLoading}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="dashboard-address-edit-hint dashboard-address-search-hint">
                Search for your area above, drag the pin to your exact spot, then save.
              </p>
            )}
          </div>
        </div>

        {/* Order History */}
        <div className="dashboard-card orders-card span-2 glass-effect">
          <div className="card-header-icon">
            <Package size={20} className="icon-primary" />
            <h4>Order History</h4>
          </div>
          
          <div className="orders-table-wrapper">
            {!hasAccessedSuite ? (
              <div className="orders-empty-state">
                <Package size={28} strokeWidth={1.5} className="orders-empty-icon" />
                <p className="orders-empty-title">No orders</p>
                <p className="orders-empty-desc">
                  Save your profile details to view your order history.
                </p>
              </div>
            ) : displayHistory.length === 0 ? (
              <div className="orders-empty-state">
                <Package size={28} strokeWidth={1.5} className="orders-empty-icon" />
                <p className="orders-empty-title">No orders</p>
                <p className="orders-empty-desc">
                  You haven’t placed an order yet. Your history will appear here after your first bowl.
                </p>
              </div>
            ) : (
              <>
                {renderOrdersSection(
                  "Current Orders",
                  activeOrders,
                  "No active orders",
                  "New orders appear here until the kitchen marks them as delivered."
                )}
                {renderOrdersSection(
                  "Previous Orders",
                  previousOrders,
                  "No previous orders",
                  "Completed orders move here after admin marks them as delivered.",
                  true
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <LocationVerifierModal 
        isOpen={isLocationVerifierOpen} 
        onClose={() => setIsLocationVerifierOpen(false)} 
        onConfirm={setEditAddress} 
      />

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          settings={deskSettings || {}}
          onClose={() => setSelectedOrder(null)}
          onRepeatOrder={
            isDeliveredOrderStatus(selectedOrder.status)
              ? () => handleRepeatOrder(selectedOrder)
              : null
          }
          repeatOrderLoading={repeatOrderId === selectedOrder.id}
        />
      )}

      <PhoneRequiredModal
        isOpen={phoneModalOpen}
        onComplete={async (phone, saveData) => {
          setPhoneInput(phone);
          setPhoneModalOpen(false);

          if (saveData?.wallet && onFetchProfileRef.current) {
            onFetchProfileRef.current(
              saveData.wallet.balance,
              saveData.orders || orderHistory,
              saveData.wallet.phone || phone,
              saveData.wallet.favorites
            );
            if (typeof window !== "undefined") {
              localStorage.setItem("theoh_coins", String(saveData.wallet.balance || 0));
            }
          }

          await refreshAuth();
          clearNeedsPhone();
          await loadAuthenticatedProfile();
        }}
      />
    </div>
  );
}

