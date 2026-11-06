"use client";

import { X, Trash2, ArrowRight, Award, Plus, Minus, ExternalLink } from "lucide-react";
import { getItemBaseName } from "../lib/cartDisplay";
import { canRedeemCoins, getCoinsRedemptionSettings } from "../lib/settings";
import ItemSizeBadge from "./ItemSizeBadge";
import SafeImage from "./SafeImage";

export default function CartDrawer({ 
  isOpen, 
  onClose, 
  onExploreMenu,
  cartItems, 
  onUpdateQty, 
  onRemoveItem,
  onViewCartItem,
  userCoins, 
  onCheckoutTrigger,
  coinDiscountApplied,
  setCoinDiscountApplied,
  settings = {}
}) {

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const basePlusAddons = item.price + (item.addonsTotal || 0);
      return total + (basePlusAddons * item.quantity);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const coinsRedemptionSettings = getCoinsRedemptionSettings(settings);
  const coinsCanRedeem = canRedeemCoins(settings, subtotal);
  const coinDiscountVal =
    coinDiscountApplied && coinsCanRedeem ? Math.min(subtotal, userCoins * 1) : 0;
  const gstPercent = parseFloat(settings.gst_percent);
  const taxRate = !Number.isNaN(gstPercent) ? gstPercent / 100 : 0.08;
  const taxableAmount = Math.max(0, subtotal - coinDiscountVal);
  const tax = taxableAmount * taxRate;

  const packingCharge = parseFloat(settings.packing_charge || "10.00");
  const grandTotal = taxableAmount + tax + packingCharge;

  const handleCheckoutClick = () => {
    onCheckoutTrigger({
      subtotal,
      coinDiscount: coinDiscountVal,
      promoDiscount: 0,
      tax,
      grandTotal,
      couponCode: "",
      useCoins: coinDiscountApplied && coinsCanRedeem,
      userCoins
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className={`cart-drawer-backdrop ${isOpen ? "open" : ""}`} onClick={onClose}></div>

      {/* Drawer Panel */}
      <div className={`cart-drawer-panel glass-dark-effect ${isOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div className="header-title">
            <span className="star-accent">★</span>
            <h3>Your Order</h3>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Cart items list */}
        <div className="drawer-body">
          {cartItems.length === 0 ? (
            <div className="empty-cart-state">
              <div className="empty-circle">
                <span>empty</span>
              </div>
              <p className="empty-title">Your bowl is waiting</p>
              <p className="empty-desc">Browse our signature collection and add your first Premium Oat Bowl.</p>
              <button className="btn-primary" onClick={onExploreMenu || onClose}>Explore Menu</button>
            </div>
          ) : (
            <div className="cart-items-container">
              {cartItems.map((item, idx) => {
                const itemUnitCost = item.price + (item.addonsTotal || 0);
                return (
                  <div key={`${item.id}-${idx}`} className="cart-item-row">
                    <SafeImage
                      src={item.image}
                      category={item.category}
                      name={item.name}
                      alt={item.name}
                      className="cart-item-img"
                    />
                    <div className="cart-item-details">
                      <h4 className="cart-item-name">
                        {getItemBaseName(item)}
                        <ItemSizeBadge item={item} className="cart-item-size-badge" />
                      </h4>
                      {item.selectedAddons && item.selectedAddons.length > 0 ? (
                        <div className="cart-item-addons">
                          {item.selectedAddons.map((a) => {
                            const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
                            return (
                            <span key={`${a.name}-${a.price}-${qty}`} className="addon-tag">
                              +{a.name}{qty > 1 ? ` ×${qty}` : ""} ₹{(parseFloat(a.price) * qty).toFixed(0)}
                            </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="cart-item-no-addons">No add-ons selected</p>
                      )}
                      <div className="cart-item-pricing">
                        <span>Base ₹{item.price.toFixed(2)}</span>
                        {(item.addonsTotal || 0) > 0 && (
                          <span> · Add-ons ₹{item.addonsTotal.toFixed(2)}</span>
                        )}
                        <span> · ₹{itemUnitCost.toFixed(2)} each</span>
                      </div>
                      {onViewCartItem && (
                        <button
                          type="button"
                          className="cart-view-item-btn"
                          onClick={() => onViewCartItem(idx)}
                        >
                          <ExternalLink size={11} /> View item & add-ons
                        </button>
                      )}
                      
                      {/* Quantity buttons & delete icon */}
                      <div className="cart-item-actions">
                        <div className="quantity-stepper">
                          <button 
                            onClick={() => onUpdateQty(idx, item.quantity - 1)}
                            className="qty-btn"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="qty-val">{item.quantity}</span>
                          <button 
                            onClick={() => onUpdateQty(idx, item.quantity + 1)}
                            className="qty-btn"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button className="trash-btn" onClick={() => onRemoveItem(idx)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="cart-item-total-price">
                      ₹{(itemUnitCost * item.quantity).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pricing Summary and loyalty checks */}
        {cartItems.length > 0 && (
          <div className="drawer-footer">
            
            {/* Coin reward checkbox */}
            {userCoins > 0 && coinsRedemptionSettings.enabled && (
              <div className="coin-reward-toggle">
                <label className="coin-label" style={{ opacity: coinsCanRedeem ? 1 : 0.75 }}>
                  <input
                    type="checkbox"
                    checked={coinDiscountApplied && coinsCanRedeem}
                    disabled={!coinsCanRedeem}
                    onChange={(e) => setCoinDiscountApplied(e.target.checked)}
                    className="coin-checkbox"
                  />
                  <div className="coin-toggle-info">
                    <span className="coin-title">
                      <Award size={14} className="icon-gold" /> Redeem {userCoins} Loyalty Coins
                    </span>
                    <span className="coin-desc">
                      {coinsCanRedeem
                        ? `Save up to ₹${(userCoins * 1).toFixed(2)} on this order`
                        : `Available when item total is ₹${coinsRedemptionSettings.minOrderAmount.toFixed(0)} or more (current: ₹${subtotal.toFixed(2)})`}
                    </span>
                  </div>
                </label>
                {coinDiscountApplied && coinsCanRedeem && (
                  <span className="coin-discount-val">-₹{coinDiscountVal.toFixed(2)}</span>
                )}
              </div>
            )}
            {userCoins > 0 && !coinsRedemptionSettings.enabled && (
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", marginBottom: "12px" }}>
                Coin redemption is currently disabled.
              </p>
            )}

            {/* Pricing Details */}
            <div className="pricing-summary-table">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {coinDiscountApplied && coinsCanRedeem && (
                <div className="summary-row saving">
                  <span>Loyalty Reward Savings</span>
                  <span>-₹{coinDiscountVal.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>GST{!Number.isNaN(gstPercent) ? ` (${gstPercent}%)` : ""}</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Packing Fee</span>
                <span>₹{packingCharge.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Delivery Fee (from ₹100 at checkout)</span>
                <span>—</span>
              </div>
              <div className="divider"></div>
              <div className="summary-row grand-total">
                <span>Grand Total</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button className="cart-checkout-btn btn-primary" onClick={handleCheckoutClick}>
              Start My Order <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
