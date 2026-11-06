"use client";

import { DEFAULT_SIZE_LABEL, shouldHideSizeQuantityLabel, filterPricedSizes, isCustomizeBowlItem, formatProductDescription, getProductUnitLabel, isCookiesCategory } from "../lib/productSizes";
import { isSingleSelectAddonCategory } from "../lib/addonHelpers";
import { Eye, Heart, Plus } from "lucide-react";
import SafeImage from "./SafeImage";
import React from "react";

interface MenuCardProps {
  item: any;
  onQuickView: (item: any, options?: any) => void;
  onAddToCart: (item: any, details?: any) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  cartLines?: any[];
  onIncrement: (item: any, sizeLabel: string, price: number) => void;
  onDecrement: (item: any, sizeLabel: string, price: number) => void;
}

function isItemInStock(item: any) {
  const available = getAvailableQuantity(item);
  const hasQuantity = available == null || available > 0;
  return hasQuantity && item.inStock !== false && item.in_stock !== false;
}

function getAvailableQuantity(item: any) {
  const stock = item.stockQuantity ?? item.quantity;
  if (stock == null) return null;
  return Math.max(0, parseInt(stock, 10) || 0);
}

function CardDescription({ text, onMore }: { text: string; onMore?: (e: React.MouseEvent) => void }) {
  const description = String(text || "").trim();
  if (!description) return null;

  return (
    <div className="card-description-block">
      <p className="card-description">{description}</p>
      <button
        type="button"
        className="card-description-more"
        onClick={(e) => {
          e.stopPropagation();
          onMore?.(e);
        }}
      >
        more
      </button>
    </div>
  );
}

export default function MenuCard({
  item,
  onQuickView,
  onAddToCart,
  isFavorite,
  onToggleFavorite,
  cartLines = [],
  onIncrement,
  onDecrement
}: MenuCardProps) {
  const inStock = isItemInStock(item);
  const availableQty = getAvailableQuantity(item);
  const rawSizes = Array.isArray(item.sizes) ? item.sizes : [];
  const isCustomize = isCustomizeBowlItem(item);
  const sizes = isCustomize
    ? [
        { label: "Medium", price: 0 },
        { label: "Large", price: 0 },
      ]
    : filterPricedSizes(rawSizes);
  const hasMultipleSizes = sizes.length > 1;
  const oatBasePrices = (item.addons || [])
    .filter((addon) => isSingleSelectAddonCategory(addon.categoryName || addon.category))
    .map((addon) => Number(addon.price) || 0)
    .filter((price) => price >= 1);
  const pricedVals = isCustomize
    ? oatBasePrices
    : sizes.map((s) => Number(s.price) || 0).filter((p) => p >= 1);
  const minPrice = pricedVals.length ? Math.min(...pricedVals) : 0;

  const totalCartQty = cartLines.reduce((sum, line) => sum + (line.quantity || 0), 0);

  const getQtyForSize = (label: string) =>
    cartLines
      .filter((line) => (line.sizeLabel || DEFAULT_SIZE_LABEL) === label)
      .reduce((sum, line) => sum + (line.quantity || 0), 0);

  const cartedSizeOptions = sizes.filter((sizeOption: any) => getQtyForSize(sizeOption.label) > 0);

  const handleOpenDetails = (e: React.MouseEvent, sizeOption: any = null) => {
    e?.stopPropagation();
    onQuickView(item, sizeOption ? { sizeLabel: sizeOption.label } : {});
  };

  const handleIncrementSize = (sizeOption: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (availableQty != null && totalCartQty >= availableQty) return;
    onIncrement(item, sizeOption.label, sizeOption.price);
  };

  const handleDecrementSize = (sizeOption: any, e: React.MouseEvent) => {
    e.stopPropagation();
    onDecrement(item, sizeOption.label, sizeOption.price);
  };

  const singleSize = sizes[0];
  const hideSizeLabel = shouldHideSizeQuantityLabel(item);
  const unitLabel = getProductUnitLabel(item);
  const displayDescription = formatProductDescription(item);

  const renderCartedSizeRow = (sizeOption: any) => {
    const qty = getQtyForSize(sizeOption.label);

    return (
      <div key={sizeOption.label} className="menu-card-carted-size-row">
        <div className="menu-card-carted-size-info">
          {!hideSizeLabel && <span className="menu-size-label">{sizeOption.label}</span>}
          {!isCustomize && (
            <span className="menu-size-price">
              {isCookiesCategory(item) && item.sizePricesRaw
                ? (/^\d+$/.test(String(item.sizePricesRaw).trim()) ? `₹${item.sizePricesRaw}` : item.sizePricesRaw)
                : `₹${Number(sizeOption.price || 0).toFixed(0)}`}
            </span>
          )}
        </div>
        <div className="card-qty-selector card-qty-selector-compact">
          <button
            type="button"
            className="qty-btn"
            onClick={(e) => handleDecrementSize(sizeOption, e)}
            aria-label={`Decrease ${sizeOption.label} quantity`}
          >
            -
          </button>
          <span className="qty-val">{qty}</span>
          <button
            type="button"
            className="qty-btn"
            onClick={(e) => handleIncrementSize(sizeOption, e)}
            disabled={availableQty != null && totalCartQty >= availableQty}
            aria-label={`Increase ${sizeOption.label} quantity`}
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`menu-card-wrapper ${!inStock ? "menu-card-out-of-stock" : ""}`}>
      <button
        className={`favorite-btn ${isFavorite ? "active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(item.id);
        }}
        aria-label="Add to Favorites"
      >
        <Heart size={16} fill={isFavorite ? "var(--accent-gold)" : "none"} />
      </button>

      <div className="card-image-container" onClick={() => onQuickView(item)}>
        <SafeImage
          src={item.image}
          category={item.category}
          name={item.name}
          alt={item.name ? `${item.name} - ${item.category || "Natural Oats"} Bowl | THE OH !` : "Natural Oats Bowl - THE OH ! Hyderabad"}
          className={`card-image ${!inStock ? "card-image-dimmed" : ""}`}
          loading="lazy"
        />
        {!inStock && (
          <div className="out-of-stock-overlay">
            <span className="out-of-stock-badge">Out of Stock</span>
          </div>
        )}
        {inStock && (
          <div className="image-overlay-hover">
            <button className="quick-view-action-btn">
              <Eye size={16} /> Quick View
            </button>
          </div>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title" onClick={() => onQuickView(item)}>
          {item.name}
        </h3>

        <CardDescription text={displayDescription} onMore={() => onQuickView(item)} />

        {inStock && (
          <div className="card-footer card-footer-with-menu card-footer-stacked" onClick={(e) => e.stopPropagation()}>
            {totalCartQty > 0 && sizes.length > 0 && (
              <div className="menu-card-carted-sizes">
                {(hasMultipleSizes ? cartedSizeOptions : singleSize ? [singleSize] : []).map((sizeOption) =>
                  renderCartedSizeRow(sizeOption)
                )}
              </div>
            )}

            <div className="card-footer-actions">
              <div className="card-price-block">
                <span className="card-price">
                  {isCustomize
                    ? minPrice > 0
                      ? `From ₹${minPrice.toFixed(0)}`
                      : "Customize"
                    : isCookiesCategory(item) && item.sizePricesRaw
                      ? (/^\d+$/.test(String(item.sizePricesRaw).trim()) ? `₹${item.sizePricesRaw}` : item.sizePricesRaw)
                      : sizes.length === 0
                      ? "—"
                    : hasMultipleSizes
                      ? `From ₹${minPrice.toFixed(0)}`
                      : `₹${Number(singleSize?.price || 0).toFixed(0)}`}
                </span>
                {totalCartQty > 0 && (
                  <span className="card-cart-badge">{totalCartQty} in cart</span>
                )}
              </div>

              <button
                type="button"
                className="card-add-btn"
                onClick={handleOpenDetails}
                title="View item details"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
        )}

        {!inStock && (
          <div className="card-footer">
            <span className="card-sold-out-label">Sold Out</span>
          </div>
        )}
      </div>
    </div>
  );
}
