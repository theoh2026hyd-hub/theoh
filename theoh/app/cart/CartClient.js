"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CheckoutStepper from "../components/CheckoutStepper";
import ProductDetailsModal from "../components/ProductDetailsModal";
import LoginRequiredModal from "../components/LoginRequiredModal";
import PhoneRequiredModal from "../components/PhoneRequiredModal";
import { useAuth } from "../hooks/useAuth";
import { ShoppingBag, ArrowRight, ExternalLink } from "lucide-react";
import { getSettingNumber, hasSettingsLoaded, canRedeemCoins, isCaloriesDisplayEnabled, isGramsDisplayEnabled } from "../lib/settings";
import { isValidPhone, getStoredPhone, getPhoneLast10 } from "../lib/phone";
import { useRouter } from "next/navigation";
import { DEFAULT_SIZE_LABEL } from "../lib/productSizes";
import { getCaloriesForSize } from "../lib/productCalories";
import { getGramsForSize } from "../lib/productPortions";
import { getItemBaseName } from "../lib/cartDisplay";
import ItemSizeBadge from "../components/ItemSizeBadge";
import SafeImage from "../components/SafeImage";
import { notifyCartUpdate } from "../components/CartFloatingBar";
import { readUserCart, writeUserCart } from "../lib/userSessionStorage";
import { reconcileCartWithMenu } from "../lib/checkoutPricingShared";
import { parseJsonResponse } from "../lib/fetchJson";
import { resolveProductImage } from "../lib/productImages";
import {
  readCheckoutResumeDraft,
  clearCheckoutResumeDraft,
  buildCheckoutOrderSummary,
} from "../lib/checkoutResume";
import EmptyState from "../components/errors/EmptyState";
import ErrorState from "../components/errors/ErrorState";

export default function CartClient() {
  const router = useRouter();
  const {
    user,
    isLoggedIn,
    isProfileComplete,
    loading: authLoading,
    needsPhone,
    clearNeedsPhone,
    refreshAuth,
  } = useAuth();
  const [cart, setCart] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuReady, setMenuReady] = useState(false);
  const [cartBootReady, setCartBootReady] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [cartEditIndex, setCartEditIndex] = useState(null);
  const [userCoins, setUserCoins] = useState(0);
  const [syncedPhone, setSyncedPhone] = useState("");
  const [orderHistory, setOrderHistory] = useState([]);
  const [checkoutSummary, setCheckoutSummary] = useState(null);
  const [checkoutResumeDraft, setCheckoutResumeDraft] = useState(null);
  const [coinDiscountApplied, setCoinDiscountApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [settings, setSettings] = useState({});
  const [activeCoupons, setActiveCoupons] = useState([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const skipInitialCartPersist = useRef(true);

  const [menuError, setMenuError] = useState(false);

  // Load menu from database only
  useEffect(() => {
    setMenuError(false);
    fetch("/api/menu", { cache: "no-store" })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (data.success && Array.isArray(data.menu)) {
          setMenuItems(data.menu);
        }
        if (data.success && data.settings) setSettings(data.settings);
        if (data.success && data.coupons) setActiveCoupons(data.coupons);
      })
      .catch((err) => {
        console.error("Error fetching menu:", err);
        setMenuError(true);
      })
      .finally(() => setMenuReady(true));
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setUserCoins(0);
      setOrderHistory([]);
      setSyncedPhone("");
      setCart([]);
      setCartBootReady(true);
      return;
    }

    if (!isProfileComplete) {
      setCartBootReady(true);
      return;
    }

    const storedCart = readUserCart(user.id);
    setCart(menuReady && menuItems.length ? reconcileCartWithMenu(storedCart, menuItems) : storedCart);
    setCartBootReady(true);

    fetch("/api/user", { cache: "no-store" })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!data.success) return;
        setUserCoins(data.wallet.balance);
        setOrderHistory(data.orders || []);
        setSyncedPhone(data.wallet.phone || "");
      })
      .catch((err) => console.error("Error loading profile:", err));
  }, [authLoading, isProfileComplete, user?.id, menuItems, menuReady]);

  useEffect(() => {
    if (!menuReady || !menuItems.length) return;
    setCart((prevCart) => {
      if (!prevCart.length) return prevCart;
      const reconciled = reconcileCartWithMenu(prevCart, menuItems);
      return JSON.stringify(reconciled) === JSON.stringify(prevCart) ? prevCart : reconciled;
    });
  }, [menuReady, menuItems]);

  useEffect(() => {
    const clearSessionState = () => setCart([]);
    window.addEventListener("theoh-session-cleared", clearSessionState);
    return () => window.removeEventListener("theoh-session-cleared", clearSessionState);
  }, []);

  useEffect(() => {
    if (!isProfileComplete || !user?.id) return;
    if (skipInitialCartPersist.current) {
      skipInitialCartPersist.current = false;
      return;
    }
    writeUserCart(user.id, cart);
    notifyCartUpdate();
  }, [cart, isProfileComplete, user?.id]);

  const handleUpdateQty = (index, newQty) => {
    if (newQty <= 0) {
      setCart((prevCart) => prevCart.filter((_, idx) => idx !== index));
      return;
    }
    setCart((prevCart) => {
      const updated = [...prevCart];
      updated[index] = {
        ...updated[index],
        quantity: newQty
      };
      return updated;
    });
  };

  const handleRemoveCartItem = (index) => {
    setCart((prevCart) => prevCart.filter((_, idx) => idx !== index));
  };

  const normalizeAddonKey = (addons = []) =>
    [...addons]
      .map((a) => `${a.name}::${Number(a.price)}::${Math.max(1, parseInt(a.quantity, 10) || 1)}`)
      .sort()
      .join("|");

  const computeAddonsTotal = (addons = []) =>
    addons.reduce((sum, a) => {
      const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
      return sum + parseFloat(a.price || 0) * qty;
    }, 0);

  const buildCartLine = (item, overrides = {}) => {
    const selectedAddons = Array.isArray(overrides.selectedAddons)
      ? overrides.selectedAddons
      : Array.isArray(item.selectedAddons)
      ? item.selectedAddons
      : [];
    const quantity = overrides.quantity ?? item.quantity ?? 1;
    const sizeLabel = overrides.sizeLabel ?? item.sizeLabel ?? DEFAULT_SIZE_LABEL;
    const unitPrice = overrides.price ?? item.price;
    const matchedSize = item.sizes?.find((size) => size.label === sizeLabel);
    const portionGrams =
      overrides.portionGrams ??
      matchedSize?.grams ??
      getGramsForSize(item.sizeGramsRaw, sizeLabel);
    return {
      ...item,
      ...overrides,
      id: Number(item.id),
      price: parseFloat(unitPrice),
      sizeLabel,
      portionGrams,
      calories: overrides.calories ?? matchedSize?.calories ?? getCaloriesForSize(item.calories, sizeLabel, item.sizeCaloriesRaw),
      selectedAddons,
      addonsTotal: computeAddonsTotal(selectedAddons),
      image: resolveProductImage(
        overrides.image ?? item.image,
        overrides.category ?? item.category,
        overrides.name ?? item.name
      ),
      category: overrides.category ?? item.category,
      quantity
    };
  };

  const cartLineKey = (line) =>
    `${Number(line.id)}|${line.sizeLabel || DEFAULT_SIZE_LABEL}|${normalizeAddonKey(line.selectedAddons)}`;

  const handleAddToCart = (item, details = null) => {
    const source = details || item;
    const newItem = buildCartLine(item, {
      selectedAddons: source.selectedAddons,
      quantity: source.quantity || 1,
      price: source.price ?? item.price,
      sizeLabel: source.sizeLabel || item.sizeLabel || DEFAULT_SIZE_LABEL,
      portionGrams: source.portionGrams,
      calories: source.calories
    });

    setCart((prevCart) => {
      const matchIdx = prevCart.findIndex((i) => cartLineKey(i) === cartLineKey(newItem));

      if (matchIdx > -1) {
        const updated = [...prevCart];
        updated[matchIdx] = {
          ...updated[matchIdx],
          quantity: updated[matchIdx].quantity + newItem.quantity,
          selectedAddons: newItem.selectedAddons,
          addonsTotal: newItem.addonsTotal,
          price: newItem.price,
          sizeLabel: newItem.sizeLabel,
          portionGrams: newItem.portionGrams ?? updated[matchIdx].portionGrams,
          calories: newItem.calories ?? updated[matchIdx].calories
        };
        return updated;
      }
      return [...prevCart, newItem];
    });
  };

  const handleReplaceCartItem = (index, item) => {
    const newItem = buildCartLine(item, {
      selectedAddons: item.selectedAddons,
      quantity: item.quantity || 1
    });
    setCart((prevCart) => {
      const updated = [...prevCart];
      updated[index] = newItem;
      return updated;
    });
  };

  const handleViewCartItem = (idx) => {
    const line = cart[idx];
    const full = menuItems.find((m) => Number(m.id) === Number(line.id)) || line;
    setCartEditIndex(idx);
    setSelectedItem(full);
  };

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
        localStorage.setItem("theoh_history", JSON.stringify(orders));
        localStorage.setItem("theoh_phone", active);

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
        console.error("Error fetching profile after order:", err);
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
    setCoinDiscountApplied(false);
    setPromoDiscount(0);
    setCheckoutSummary(null);
    setCheckoutResumeDraft(null);
    clearCheckoutResumeDraft();
  };

  const handleAddMoreItemsFromCart = () => {
    router.push("/?section=menu");
  };

  const handleAddMoreItems = () => {
    setCheckoutSummary(null);
    router.push("/?section=menu");
  };

  useEffect(() => {
    if (!cartBootReady) return;

    const draft = readCheckoutResumeDraft();
    if (!draft?.awaitResume || draft.source !== "cart" || checkoutSummary) return;

    const cartTotalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartTotalQty <= (draft.cartTotalQty || 0)) return;

    clearCheckoutResumeDraft();
    setCoinDiscountApplied(Boolean(draft.coinDiscountApplied));
    setPromoDiscount((draft.localPromoPercent || 0) * 100);
    setCheckoutResumeDraft(draft);
    setCheckoutSummary(
      buildCheckoutOrderSummary({
        cart,
        settings,
        userCoins,
        coinDiscountApplied: Boolean(draft.coinDiscountApplied),
        promoDiscountPercent: (draft.localPromoPercent || 0) * 100,
        isProfileComplete,
      })
    );
  }, [cart, checkoutSummary, settings, userCoins, isProfileComplete, cartBootReady]);

  // Compute pricing totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price + (item.addonsTotal || 0)) * item.quantity, 0);
  const coinsCanRedeem = canRedeemCoins(settings, subtotal);
  const coinDiscountVal = coinDiscountApplied && coinsCanRedeem ? Math.min(subtotal, userCoins * 1) : 0;
  const promoDiscountVal = (subtotal - coinDiscountVal) * (promoDiscount / 100);
  const totalDiscount = coinDiscountVal + promoDiscountVal;
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  
  const gstPercent = getSettingNumber(settings, "gst_percent");
  const settingsReady = hasSettingsLoaded(settings);
  const taxRate = gstPercent !== null ? gstPercent / 100 : 0;
  const tax = settingsReady ? taxableAmount * taxRate : 0;
  const grandTotal = settingsReady ? taxableAmount + tax : 0;

  const triggerCheckout = () => {
    const summary = {
      subtotal,
      coinDiscount: coinDiscountVal,
      promoDiscount: promoDiscountVal,
      tax,
      grandTotal,
      couponCode: "",
      userCoins: isProfileComplete ? userCoins : 0,
      useCoins: coinDiscountApplied && coinsCanRedeem && isProfileComplete
    };

    if (!isProfileComplete) {
      if (!isLoggedIn) {
        setPendingCheckout(summary);
        setShowLoginModal(true);
      }
      return;
    }

    setCheckoutSummary(summary);
  };

  const handleLoginSuccess = async () => {
    setShowLoginModal(false);

    const result = await refreshAuth();
    if (!result?.ok || result.needsPhone) {
      setPendingCheckout(null);
      return;
    }

    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setUserCoins(data.wallet.balance);
        setOrderHistory(data.orders || []);
        setSyncedPhone(data.wallet.phone || "");
      }
    } catch (err) {
      console.error("Failed to refresh profile after login:", err);
    }

    if (pendingCheckout) {
      setCheckoutSummary(pendingCheckout);
      setPendingCheckout(null);
    }
  };

  const handlePhoneComplete = async (phone, saveData) => {
    if (saveData?.wallet) {
      setUserCoins(saveData.wallet.balance || 0);
      setSyncedPhone(saveData.wallet.phone || phone);
      if (typeof window !== "undefined") {
        localStorage.setItem("theoh_coins", String(saveData.wallet.balance || 0));
        localStorage.setItem("theoh_phone", saveData.wallet.phone || phone);
      }
    }

    const result = await refreshAuth();
    if (result?.ok && !result.needsPhone) {
      clearNeedsPhone();
    }

    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      const data = await parseJsonResponse(res);
      if (data.success) {
        setUserCoins(data.wallet.balance);
        setOrderHistory(data.orders || []);
        setSyncedPhone(data.wallet.phone || "");
      }
    } catch (err) {
      console.error("Failed to refresh profile after phone save:", err);
    }
  };

  const isCartLoading = authLoading || !menuReady || (isProfileComplete && !cartBootReady);

  return (
    <div className="app-container">
      <Navbar 
        onCartToggle={() => {}} 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onDashboardToggle={() => {}}
        activeDashboard=""
        userCoins={userCoins}
        isLoggedIn={isProfileComplete}
        activeSection="cart"
        setActiveSection={() => {}}
      />
      <main className="section-padding checkout-page-main" style={{ marginTop: "100px", minHeight: "70vh" }}>
        {checkoutSummary ? (
          <CheckoutStepper 
            orderSummary={checkoutSummary}
            cartItems={cart}
            onOrderSuccess={handleOrderConfirmed}
            onClose={handleCheckoutClose}
            onAddMoreItems={handleAddMoreItems}
            checkoutSource="cart"
            resumeDraft={checkoutResumeDraft}
            onResumeConsumed={() => setCheckoutResumeDraft(null)}
            addUserCoins={(coins) => {
              const updatedCoins = userCoins + coins;
              setUserCoins(updatedCoins);
              localStorage.setItem("theoh_coins", updatedCoins.toString());
            }}
            settings={settings}
            onNavigateAfterSuccess={(target) => {
              handleCheckoutClose();
              if (target === "history") {
                router.push("/profile");
                return;
              }
              router.push("/?section=menu");
            }}
            activeCoupons={activeCoupons}
            syncedPhone={syncedPhone}
            menuItems={menuItems}
            onAddToCart={handleAddToCart}
            onUpdateCartItem={handleReplaceCartItem}
            onRemoveCartItem={handleRemoveCartItem}
            userCoins={userCoins}
          />
        ) : isCartLoading ? (
          <div className="menu-catalog-loading" aria-live="polite" aria-busy="true">
            <div className="loading-spinner-luxury" aria-hidden="true" />
          </div>
        ) : menuError && menuItems.length === 0 ? (
          <ErrorState
            title="Unable to Load Menu"
            description="We couldn't load the menu right now. Please check your connection and try again."
            variant="api"
            onRetry={() => window.location.reload()}
          />
        ) : cart.length === 0 ? (
          <EmptyState
            icon="cart"
            title="Your Cart Is Empty"
            description="Add some items from our menu to get started."
            actionLabel="Explore Menu"
            onAction={() => router.push("/?section=menu")}
          />
        ) : (
          <div className="cart-page-content">
            <h2 className="cart-page-title">Cart Selections</h2>
            <div className="cart-layout-grid">
              <div className="cart-page-list">
                {cart.map((item, idx) => {
                  const unitCost = item.price + (item.addonsTotal || 0);
                  return (
                    <div key={idx} className="cart-page-item">
                      <div className="cart-page-item-top">
                        <SafeImage
                          src={item.image}
                          category={item.category}
                          name={item.name}
                          alt={item.name}
                          className="cart-page-item-img"
                        />
                        <div className="cart-page-item-body">
                          <h4 className="cart-page-item-name">
                            {getItemBaseName(item)}
                            <ItemSizeBadge item={item} />
                          </h4>
                          {item.selectedAddons && item.selectedAddons.length > 0 ? (
                            <div className="cart-page-item-addons">
                              {item.selectedAddons.map((a) => {
                                const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
                                return (
                                <span key={`${a.name}-${a.price}-${qty}`} className="addon-tag cart-page-addon-tag">
                                  +{a.name}{qty > 1 ? ` ×${qty}` : ""} ₹{(parseFloat(a.price) * qty).toFixed(0)}
                                </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="cart-page-no-addons">No add-ons selected</p>
                          )}
                          <p className="cart-page-item-meta">
                            Base ₹{item.price.toFixed(2)}
                            {(item.addonsTotal || 0) > 0 && ` · Add-ons ₹${item.addonsTotal.toFixed(2)}`}
                            {` · ₹${unitCost.toFixed(2)} each`}
                          </p>
                          <button
                            type="button"
                            className="cart-view-item-btn cart-page-view-btn"
                            onClick={() => handleViewCartItem(idx)}
                          >
                            <ExternalLink size={11} /> View item & add-ons
                          </button>
                        </div>
                      </div>
                      <div className="cart-page-item-bottom">
                        <div className="cart-page-qty">
                          <button type="button" className="cart-page-qty-btn" onClick={() => handleUpdateQty(idx, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                          <span className="cart-page-qty-val">{item.quantity}</span>
                          <button type="button" className="cart-page-qty-btn" onClick={() => handleUpdateQty(idx, item.quantity + 1)} aria-label="Increase quantity">+</button>
                        </div>
                        <div className="cart-page-price-col">
                          <span className="cart-page-item-price price-text">
                            ₹{(unitCost * item.quantity).toFixed(2)}
                          </span>
                          <button type="button" className="cart-page-remove-btn" onClick={() => handleRemoveCartItem(idx)}>Remove</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cart-page-summary glass-effect">
                <h3 className="cart-page-summary-title">Bill Details</h3>
                <div className="cart-page-summary-rows price-text">
                  <div className="cart-page-summary-row">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="cart-page-summary-row cart-page-summary-row-accent">
                    <span>GST{gstPercent !== null ? ` (${gstPercent}%)` : ""}:</span>
                    <span>{settingsReady ? `₹${tax.toFixed(2)}` : "—"}</span>
                  </div>
                  <div className="cart-page-summary-row cart-page-summary-total">
                    <span>Total Amount:</span>
                    <span>{settingsReady ? `₹${grandTotal.toFixed(2)}` : "—"}</span>
                  </div>
                  {!settingsReady && (
                    <p className="cart-page-summary-note">Loading GST from kitchen settings…</p>
                  )}
                  <button
                    type="button"
                    onClick={handleAddMoreItemsFromCart}
                    className="btn-secondary cart-page-add-more-btn"
                  >
                    Add More Items
                  </button>
                  <button
                    onClick={triggerCheckout}
                    className="btn-primary cart-page-checkout-btn"
                    disabled={!settingsReady}
                  >
                    Proceed to Checkout <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      {!checkoutSummary && (
        <Footer onDashboardToggle={() => {}} setActiveSection={() => {}} />
      )}

      {selectedItem && (
        <ProductDetailsModal
          item={selectedItem}
          cartLine={cartEditIndex != null ? cart[cartEditIndex] : null}
          showCalories={isCaloriesDisplayEnabled(settings)}
          showGrams={isGramsDisplayEnabled(settings)}
          onClose={() => {
            setSelectedItem(null);
            setCartEditIndex(null);
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
        }}
        onAuthenticated={handleLoginSuccess}
        message="Sign in to checkout and use your reward coins."
      />

      <PhoneRequiredModal
        isOpen={isLoggedIn && needsPhone}
        onComplete={handlePhoneComplete}
      />
    </div>
  );
}
