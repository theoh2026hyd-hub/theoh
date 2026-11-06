"use client";

import { X } from "lucide-react";
import OrderEnjoyDetails from "./OrderEnjoyDetails";
import LoadingButton from "./LoadingButton";
import { getOrderDisplayId } from "../lib/orderNumber";

export default function OrderDetailsModal({
  order,
  onClose,
  settings = {},
  onRepeatOrder = null,
  repeatOrderLoading = false
}) {
  if (!order) return null;

  return (
    <div className="modal-overlay order-details-overlay" onClick={onClose}>
      <div className="order-details-modal glass-effect" onClick={(e) => e.stopPropagation()}>
        <div className="order-details-header">
          <div>
            <span className="order-details-eyebrow">Order Details</span>
            <h3 className="order-details-title">
              {getOrderDisplayId(order) || "Order"}
            </h3>
            <p className="order-details-meta">{order.date}</p>
          </div>
          <button type="button" className="order-details-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={`order-details-status order-status ${order.statusClass || "processing"}`}>
          <span className="status-dot"></span>
          {order.status || "Processing"}
        </div>

        <OrderEnjoyDetails
          order={order}
          settings={settings}
        />

        {onRepeatOrder && (
          <div className="order-details-actions">
            <LoadingButton
              type="button"
              className="order-repeat-btn order-repeat-btn-modal"
              onClick={onRepeatOrder}
              loading={repeatOrderLoading}
              loadingText="Adding to cart…"
            >
              Repeat Order
            </LoadingButton>
          </div>
        )}
      </div>
    </div>
  );
}
