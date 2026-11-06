"use client";

import {
  formatCartLinePortionInline,
  formatCartLinePortionWithQty
} from "../lib/productPortions";

export default function CartLinePortionMeta({
  item,
  variant = "checkout",
  className = "",
  includePrice = false
}) {
  if (!item) return null;

  const text =
    variant === "inline"
      ? formatCartLinePortionInline(item, { includePrice })
      : formatCartLinePortionWithQty(item);

  if (!text) return null;

  return <p className={`cart-line-portion-meta ${className}`.trim()}>{text}</p>;
}
