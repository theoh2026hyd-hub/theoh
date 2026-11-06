"use client";

import { Award, Check } from "lucide-react";
import SafeImage from "./SafeImage";
import { getItemBaseName, getItemSizeLabel } from "../lib/cartDisplay";
import { buildOrderEnjoyDetails } from "../lib/orderEnjoyDetails";
import { getDeliveryRouteMapEmbedUrl, getDeliveryRouteMapLink } from "../lib/delivery";

export default function OrderEnjoyDetails({
  order,
  settings = {},
  showSuccessHeader = false
}) {
  const details = buildOrderEnjoyDetails(order, settings);
  const routeEmbedUrl =
    details.diningMode === "delivery" ? getDeliveryRouteMapEmbedUrl(details.location) : null;

  return (
    <div className="order-enjoy-details">
      {showSuccessHeader && (
        <>
          <div className="success-lottie-check">
            <div className="checkmark-ring"></div>
            <Check size={28} className="checkmark-icon" />
          </div>
          <h3 className="success-title">Payment Successful</h3>
          <p className="success-subtitle">Your order is confirmed. Here are your details.</p>
        </>
      )}

      <div className="enjoy-order-block">
        <h4 className="enjoy-block-title">Items Ordered</h4>
        <div className="enjoy-items-list">
          {details.itemsList.length > 0 ? (
            details.itemsList.map((item, idx) => {
              const sizeLabel = getItemSizeLabel(item);
              const baseName = getItemBaseName(item);
              const addons = item.selectedAddons || item.selected_addons || [];

              return (
                <div key={idx} className="enjoy-item-row">
                  <SafeImage
                    src={item.image}
                    category={item.category || "Oats"}
                    name={item.name}
                    alt={baseName}
                    className="enjoy-item-thumb"
                  />
                  <div className="enjoy-item-info">
                    <span className="enjoy-item-name">
                      {item.quantity}x {baseName}
                      {sizeLabel ? ` (${sizeLabel})` : ""}
                    </span>
                    {addons.length > 0 && (
                      <span className="enjoy-item-addons">
                        + {addons.map((addon) => {
                          const qty = Math.max(1, parseInt(addon.quantity, 10) || 1);
                          const line = parseFloat(addon.price || 0) * qty;
                          return `${addon.name}${qty > 1 ? ` ×${qty}` : ""} (₹${line.toFixed(0)})`;
                        }).join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="enjoy-item-price">
                    ₹{((item.price + (item.addonsTotal || 0)) * item.quantity).toFixed(2)}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="order-details-empty-copy">No item breakdown available for this order.</p>
          )}
        </div>
      </div>

      <div className="success-receipt-card">
        <h4 className="enjoy-block-title" style={{ marginBottom: "12px" }}>Delivery & Guest</h4>
        <div className="receipt-row">
          <span>Guest</span>
          <span>{details.customerName}</span>
        </div>
        <div className="receipt-row">
          <span>Phone</span>
          <span>{details.customerPhone}</span>
        </div>
        <div className="receipt-row">
          <span>{details.diningMode === "delivery" ? "Deliver To" : "Pickup"}</span>
          <span>
            {details.diningMode === "delivery"
              ? details.deliveryAddress.split(" || Map: ")[0] || "Not available"
              : details.tableNo
                ? `Pickup: ${details.tableNo}`
                : "Pickup location not specified"}
          </span>
        </div>
        <div className="receipt-row">
          <span>Scheduled</span>
          <span>{details.scheduled}</span>
        </div>

        <div className="receipt-divider" />

        <h4 className="enjoy-block-title" style={{ marginBottom: "12px" }}>Payment Summary</h4>
        <div className="receipt-row">
          <span>Subtotal</span>
          <span>₹{details.subtotal.toFixed(2)}</span>
        </div>
        {details.coinDiscount > 0 && (
          <div className="receipt-row">
            <span>Coins Redeemed</span>
            <span>-₹{details.coinDiscount.toFixed(2)}</span>
          </div>
        )}
        {details.promoDiscount > 0 && (
          <div className="receipt-row">
            <span>Coupon{details.promoCode ? ` (${details.promoCode})` : ""}</span>
            <span>-₹{details.promoDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="receipt-row">
          <span>Tax{details.gstPercent != null ? ` (${details.gstPercent}%)` : ""}</span>
          <span>₹{details.tax.toFixed(2)}</span>
        </div>
        <div className="receipt-row">
          <span>Packing Fee</span>
          <span>₹{details.packingFee.toFixed(2)}</span>
        </div>
        {details.diningMode === "delivery" && (
          <div className="receipt-row">
            <span>
              Delivery Fee
              {details.distanceKm != null ? ` (${details.distanceKm} km)` : ""}
            </span>
            <span>₹{details.deliveryFee.toFixed(2)}</span>
          </div>
        )}
        <div className="receipt-row receipt-row-total">
          <span>Total Paid</span>
          <span>₹{details.grandTotal.toFixed(2)}</span>
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
            <p className="reward-desc">
              +{details.coinsEarned} Reserve coins credited to your account
            </p>
          </div>
        </div>
      </div>

      {details.diningMode === "delivery" && routeEmbedUrl && (
        <div className="enjoy-route-block">
          <h4 className="enjoy-block-title">Delivery Route</h4>
          <p className="enjoy-route-caption">
            Shortest two-wheeler route from {details.restaurantAddress} to your location
          </p>
          <div className="enjoy-route-map delivery-route-map">
            <iframe
              title="Delivery route map"
              src={routeEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a
            href={getDeliveryRouteMapLink(details.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="enjoy-route-link"
          >
            Open in Maps
          </a>
        </div>
      )}

    </div>
  );
}
