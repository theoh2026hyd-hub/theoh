"use client";

import { ShoppingBag, Search, Bell, Heart, Package, Inbox } from "lucide-react";
import ErrorIllustration from "./ErrorIllustration";

/**
 * EmptyState — Professional empty data state component.
 * Used when a list/collection has no items (cart, orders, search results, etc.).
 *
 * Props:
 *   icon           — Lucide icon name string or null for illustration
 *   title          — Empty state heading
 *   description    — Short explanation
 *   actionLabel    — CTA button text
 *   onAction       — CTA button callback
 *   actionHref     — CTA button link (alternative to onAction)
 *   illustration   — ErrorIllustration type override
 *   compact        — Smaller version
 */

const ICON_MAP = {
  cart: ShoppingBag,
  search: Search,
  notifications: Bell,
  favorites: Heart,
  orders: Package,
  inbox: Inbox,
};

export default function EmptyState({
  icon,
  title = "Nothing Here Yet",
  description = "There's nothing to display at the moment.",
  actionLabel,
  onAction,
  actionHref,
  illustration = "empty",
  compact = false,
}) {
  const IconComponent = icon ? ICON_MAP[icon] || null : null;

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionHref && typeof window !== "undefined") {
      window.location.href = actionHref;
    }
  };

  return (
    <div className={`empty-state${compact ? " empty-state--compact" : ""}`} role="status">
      <div className="empty-state-visual" aria-hidden="true">
        {IconComponent ? (
          <div className="empty-state-icon">
            <IconComponent size={compact ? 32 : 44} />
          </div>
        ) : (
          <ErrorIllustration type={illustration} className="empty-state-illustration" />
        )}
      </div>

      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>

      {(actionLabel && (onAction || actionHref)) && (
        <button
          type="button"
          className="empty-state-btn"
          onClick={handleAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
