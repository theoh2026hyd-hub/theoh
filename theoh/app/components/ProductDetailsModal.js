"use client";

import { useState, useEffect, useMemo } from "react";
import {
  DEFAULT_SIZE_LABEL,
  shouldHideSizeQuantityLabel,
  isCookiesCategory,
  isCustomizeBowlItem,
  filterPricedSizes,
  buildCustomizeSizeOptions,
  getCustomizeAddonUnitPrice,
  formatProductDescription,
  getProductUnitLabel,
  getAddonUnitLabel,
} from "../lib/productSizes";
import { getCaloriesForSize, getAddonServingCalories, ADDON_PORTION_GRAMS } from "../lib/productCalories";
import { resolveProductImage } from "../lib/productImages";
import SafeImage from "./SafeImage";
import { lookupAddonCalories } from "../lib/addonCalories";
import {
  computeAddonsTotal,
  getAddonQuantity,
  groupAddonsByCategory,
  canIncrementAddon,
  isAddonBlocked,
  isSingleSelectAddonCategory,
  getAddonCategoryQuantityLimit,
  getSelectedQtyInCategory,
  getAddonCategoryHint,
} from "../lib/addonHelpers";
import { X, Plus, Minus } from "lucide-react";
import { useOverlayBack, dismissOverlayHistory } from "../lib/overlayHistory";

function formatSizeCustomerGets(sizeOption, baseCalories, sizeCaloriesRaw = "", { showCalories = true, showGrams = true, cookiesOnlyGrams = false } = {}) {
  const calories =
    sizeOption.calories ?? getCaloriesForSize(baseCalories, sizeOption.label, sizeCaloriesRaw);
  const parts = [];
  if (!cookiesOnlyGrams && showCalories && calories != null && Number(calories) > 0) {
    parts.push(`${calories} kcal`);
  }
  if (showGrams && sizeOption.grams != null && Number(sizeOption.grams) > 0) {
    if (cookiesOnlyGrams) {
      parts.push("approx 180g-200g");
    } else {
      parts.push(`${sizeOption.grams}g`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

function resolveAddon(addon) {
  const caloriesPer100g = addon.calories ?? lookupAddonCalories(addon.name);
  const portionGrams = addon.grams != null ? parseInt(addon.grams, 10) : ADDON_PORTION_GRAMS;
  return {
    ...addon,
    grams: Number.isFinite(portionGrams) && portionGrams > 0 ? portionGrams : ADDON_PORTION_GRAMS,
    calories: caloriesPer100g ?? addon.calories ?? null
  };
}

function getRawSizes(item) {
  if (Array.isArray(item.sizes) && item.sizes.length > 0) return item.sizes;
  return [];
}

export default function ProductDetailsModal({
  item,
  onClose,
  onAddToCart,
  cartLine = null,
  onUpdateCartLine = null,
  initialSizeLabel = null,
  manageHistory = true,
  showCalories = true,
  showGrams = true,
}) {
  const [activeTab, setActiveTab] = useState("nutrition");
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [mainImage, setMainImage] = useState(
    resolveProductImage(item.image, item.category, item.name)
  );
  const isCustomize = isCustomizeBowlItem(item);
  const [selectedSizeLabel, setSelectedSizeLabel] = useState(() => {
    const preferred = cartLine?.sizeLabel || initialSizeLabel;
    if (isCustomize) return preferred === "Large" ? "Large" : "Medium";
    return preferred || getRawSizes(item)[0]?.label || DEFAULT_SIZE_LABEL;
  });

  const caloriesVisible = (item.showCalories ?? item.show_calories ?? showCalories) !== false;
  const gramsVisible = (item.showGrams ?? item.show_grams ?? showGrams) !== false;
  const ingredientsVisible =
    item.showIngredients !== false && item.show_ingredients !== false;
  const nutrientsVisible =
    item.showNutrients !== false && item.show_nutrients !== false;
  const detailTabs = [
    ...(nutrientsVisible ? ["nutrition"] : []),
    ...(ingredientsVisible ? ["ingredients"] : []),
  ];
  const unitLabel = getProductUnitLabel(item);
  const displayDescription = formatProductDescription(item);

  const isEditing = cartLine != null && typeof onUpdateCartLine === "function";

  const addonsList = item.addons || [];
  const addonGroups = groupAddonsByCategory(addonsList);

  const sizes = useMemo(() => {
    const raw = getRawSizes(item);
    if (isCustomize) return buildCustomizeSizeOptions(item, raw);
    return filterPricedSizes(raw);
  }, [item, isCustomize]);

  const selectedSize =
    sizes.find((s) => s.label === selectedSizeLabel) || sizes[0] || {
      label: DEFAULT_SIZE_LABEL,
      price: 0,
    };

  useEffect(() => {
    setQuantity(cartLine?.quantity ?? 1);
    const incomingAddons = (cartLine?.selectedAddons || []).map((addon) => {
      const resolved = resolveAddon(addon);
      const basePrice = Number(addon.basePrice ?? addon.price) || 0;
      const sizeLabel = cartLine?.sizeLabel || initialSizeLabel || "Medium";
      return {
        ...resolved,
        basePrice,
        price: getCustomizeAddonUnitPrice(
          { ...resolved, basePrice, category: addon.category || addon.categoryName },
          isCustomizeBowlItem(item) ? sizeLabel : "Medium"
        ),
        quantity: Math.max(1, getAddonQuantity(addon) || 1),
      };
    });
    setSelectedAddons(incomingAddons);
    setMainImage(resolveProductImage(item.image, item.category, item.name));
    const nextTabs = [
      ...((item.showNutrients !== false && item.show_nutrients !== false) ? ["nutrition"] : []),
      ...((item.showIngredients !== false && item.show_ingredients !== false) ? ["ingredients"] : []),
    ];
    setActiveTab(nextTabs[0] || "ingredients");
    const preferredLabel = cartLine?.sizeLabel || initialSizeLabel;
    if (isCustomizeBowlItem(item)) {
      setSelectedSizeLabel(preferredLabel === "Large" ? "Large" : "Medium");
    } else {
      const raw = getRawSizes(item);
      const priced = filterPricedSizes(raw);
      const options = priced.length > 0 ? priced : raw;
      const matched = preferredLabel
        ? options.find((s) => s.label === preferredLabel) || options[0]
        : options[0];
      setSelectedSizeLabel(matched?.label || DEFAULT_SIZE_LABEL);
    }
  }, [item, cartLine, initialSizeLabel]);

  useEffect(() => {
    if (!sizes.length) return;
    if (!sizes.some((s) => s.label === selectedSizeLabel)) {
      setSelectedSizeLabel(sizes[0].label);
    }
  }, [sizes, selectedSizeLabel]);

  // When Large/Medium changes, refresh oat-base charged prices.
  useEffect(() => {
    if (!isCustomize) return;
    setSelectedAddons((prev) =>
      prev.map((addon) => {
        const basePrice = Number(addon.basePrice ?? addon.price) || 0;
        return {
          ...addon,
          basePrice,
          price: getCustomizeAddonUnitPrice(
            { ...addon, basePrice },
            selectedSizeLabel
          ),
        };
      })
    );
  }, [isCustomize, selectedSizeLabel]);

  const getSelectedQty = (addonName) => {
    const match = selectedAddons.find((entry) => entry.name === addonName);
    return getAddonQuantity(match);
  };

  const setAddonQuantity = (addon, nextQty, categoryName = "") => {
    const cat = categoryName || addon.category || addon.categoryName || "";
    const limitOpts = { enforceLimits: isCustomize };
    const catalogPrice = Number(addon.basePrice ?? addon.price) || 0;
    const resolved = {
      ...resolveAddon(addon),
      category: cat,
      categoryName: cat,
      basePrice: catalogPrice,
      price: isCustomize
        ? getCustomizeAddonUnitPrice(
            { ...addon, basePrice: catalogPrice, category: cat, categoryName: cat },
            selectedSizeLabel
          )
        : catalogPrice,
    };
    let qty = Math.max(0, Math.min(99, parseInt(nextQty, 10) || 0));

    setSelectedAddons((prev) => {
      const currentQty = prev.find((entry) => entry.name === resolved.name)?.quantity || 0;
      const without = prev.filter((entry) => entry.name !== resolved.name);

      if (qty <= 0) return without;

      if (qty > currentQty && !canIncrementAddon(resolved, prev, cat, limitOpts)) {
        return prev;
      }

      if (isCustomize && isSingleSelectAddonCategory(cat)) {
        qty = 1;
      }

      const limit = getAddonCategoryQuantityLimit(cat, limitOpts);
      if (limit != null) {
        const othersTotal = getSelectedQtyInCategory(without, cat);
        const maxForThis = Math.max(0, limit - othersTotal);
        qty = Math.min(qty, maxForThis);
        if (qty <= 0) return without;
      }

      return [...without, { ...resolved, quantity: qty }];
    });
  };

  const addonsTotal = computeAddonsTotal(selectedAddons);
  const finalPrice = (selectedSize.price + addonsTotal) * quantity;
  const availableQty = item.stockQuantity != null
    ? parseInt(item.stockQuantity, 10)
    : item.quantity != null
    ? parseInt(item.quantity, 10)
    : null;
  const inStock =
    (availableQty == null || availableQty > 0) &&
    item.inStock !== false &&
    item.in_stock !== false;
  const maxSelectableQty = availableQty ?? 99;
  const selectedCalories =
    selectedSize.calories ??
    getCaloriesForSize(item.calories, selectedSize.label, item.sizeCaloriesRaw);

  const handleClose = () => {
    onClose();
    if (manageHistory) {
      dismissOverlayHistory();
    }
  };

  const handleAddToCartClick = () => {
    if (!inStock) return;
    const hideSize = shouldHideSizeQuantityLabel({ ...item, sizes }) || selectedSize.hideSizeLabel;
    const payload = {
      ...item,
      price: selectedSize.price,
      sizeLabel: hideSize ? null : selectedSize.label,
      hideSizeLabel: hideSize,
      portionGrams: selectedSize.grams,
      calories: selectedCalories,
      selectedAddons,
      addonsTotal,
      quantity
    };
    if (isEditing) {
      onUpdateCartLine(payload);
    } else {
      onAddToCart(item, payload);
    }
    handleClose();
  };

  const galleryImages = [
    resolveProductImage(item.image, item.category, item.name)
  ];

  useOverlayBack(manageHistory, "product-details", onClose);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="modal-overlay product-details-overlay" onClick={handleClose}>
      <button
        className="modal-close-btn product-details-close"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        type="button"
        aria-label="Close"
      >
        <X size={20} strokeWidth={2.5} />
      </button>

      <div className="modal-container product-details-panel" onClick={(e) => e.stopPropagation()}>
        <div className="product-details-scroll">
          <div className="modal-grid">
            <div className="modal-gallery">
              <div className="main-image-wrapper">
                <SafeImage
                  src={mainImage}
                  category={item.category}
                  name={item.name}
                  alt={item.name}
                  className={`modal-main-image ${!inStock ? "card-image-dimmed" : ""}`}
                />
                {!inStock && (
                  <div className="out-of-stock-overlay modal-out-of-stock">
                    <span className="out-of-stock-badge">Out of Stock</span>
                  </div>
                )}
              </div>
              <div className="gallery-thumbnails">
                {galleryImages.length > 1 &&
                  galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      className={`thumbnail-btn ${mainImage === img ? "active" : ""}`}
                      onClick={() => setMainImage(img)}
                    >
                      <SafeImage
                        src={img}
                        category={item.category}
                        name={item.name}
                        alt="thumbnail"
                        className="thumbnail-img"
                      />
                    </button>
                  ))}
              </div>
            </div>

            <div className="modal-details">
              <div className="details-header">
                {String(item.subCategory || "").trim().toLowerCase() === "oats signature" && (
                  <span className="details-tag">Signature Collection</span>
                )}
                <h2 className="details-title">{item.name}</h2>

                <p className="details-intro-desc">{displayDescription}</p>

                {sizes.length > 0 && (
                <div className="details-size-section">
                  <h4 className="details-size-heading">
                    {shouldHideSizeQuantityLabel(item) || sizes.length <= 1 ? "Price" : "Choose Size"}
                  </h4>
                  <div
                    className={`details-size-options details-size-options-count-${Math.max(
                      sizes.length,
                      1
                    )}${
                      !isCustomize && (shouldHideSizeQuantityLabel(item) || sizes.length <= 1)
                        ? " details-size-options-price-only"
                        : ""
                    }${isCustomize ? " details-size-options-customize" : ""}`}
                  >
                    {sizes.map((sizeOption) => {
                      const customerGets = formatSizeCustomerGets(
                        sizeOption,
                        item.calories,
                        item.sizeCaloriesRaw,
                        {
                          showCalories: caloriesVisible,
                          showGrams: gramsVisible,
                          cookiesOnlyGrams: isCookiesCategory(item),
                        }
                      );
                      const hideLabel = shouldHideSizeQuantityLabel(item);
                      const hidePrice = isCustomize || sizeOption.hidePrice;
                      return (
                        <button
                          key={sizeOption.label}
                          type="button"
                          className={`details-size-btn ${selectedSize.label === sizeOption.label ? "active" : ""}${
                            hideLabel ? " details-size-btn-price-only" : ""
                          }${hidePrice ? " details-size-btn-label-only" : ""}`}
                          onClick={() => setSelectedSizeLabel(sizeOption.label)}
                        >
                          {!hideLabel && <span>{sizeOption.label}</span>}
                          {!hidePrice && (
                            <strong>
                              {isCookiesCategory(item) && item.sizePricesRaw
                                ? (/^\d+$/.test(String(item.sizePricesRaw).trim()) ? `₹${item.sizePricesRaw}` : item.sizePricesRaw)
                                : `₹${Number(sizeOption.price).toFixed(0)}`}
                            </strong>
                          )}
                          {customerGets && (
                            <span className="details-size-calories">{customerGets}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {isCustomize && (
                    <p className="details-size-customize-note">
                      Large adds ₹15 to each oat base price.
                    </p>
                  )}
                </div>
                )}
              </div>

              {item.category !== "Butter" && addonsList.length > 0 && (
                <div className="details-section customization-section">
                  <h4 className="section-title">
                    {String(item.category).toLowerCase() === "breads" ||
                    String(item.categoryRaw || "").toLowerCase() === "bread & butter"
                      ? "Extra Butter Addon"
                      : String(item.category).toLowerCase().includes("customize") ||
                          String(item.categoryRaw || "").toLowerCase().includes("customize") ||
                          String(item.name || "").toLowerCase().includes("customize your bowl")
                        ? "Craft Your Bowl"
                        : "Add-ons"}
                  </h4>
                  {addonGroups.map((group) => {
                    const limitOpts = { enforceLimits: isCustomize };
                    const categoryLimit = getAddonCategoryQuantityLimit(group.category, limitOpts);
                    const categoryUsed = getSelectedQtyInCategory(selectedAddons, group.category);
                    const categoryHint = getAddonCategoryHint(group.category, limitOpts);
                    return (
                    <div key={group.category} className="addon-group-block">
                      <h5 className="addon-group-title">{group.category}</h5>
                      {categoryHint && (
                        <p className="addon-group-hint">
                          {categoryHint}
                          {categoryLimit != null ? ` (${categoryUsed}/${categoryLimit} selected)` : ""}
                        </p>
                      )}
                      <div className="addons-grid">
                        {group.addons.map((addon) => {
                          const catalogPrice = Number(addon.price) || 0;
                          const resolved = resolveAddon({
                            ...addon,
                            category: group.category,
                            categoryName: group.category,
                            basePrice: catalogPrice,
                            price: catalogPrice,
                          });
                          const selectedQty = getSelectedQty(addon.name);
                          const isSelected = selectedQty > 0;
                          const blocked = isAddonBlocked(resolved, selectedAddons, group.category, limitOpts);
                          const canAddMore = canIncrementAddon(resolved, selectedAddons, group.category, limitOpts);
                          const displayPrice = isCustomize
                            ? getCustomizeAddonUnitPrice(
                                {
                                  ...resolved,
                                  basePrice: catalogPrice,
                                  category: group.category,
                                  categoryName: group.category,
                                },
                                selectedSizeLabel
                              )
                            : catalogPrice;
                          const servingKcal = getAddonServingCalories({
                            ...resolved,
                            quantity: 1
                          });
                          const addonUnit = getAddonUnitLabel(addon);
                          return (
                            <div
                              key={addon.id || addon.name}
                              className={`addon-card ${isSelected ? "selected" : ""}${
                                blocked && !isSelected ? " addon-card-blocked" : ""
                              }`}
                            >
                              <div className="addon-info">
                                <span className="addon-name">{addon.name}</span>
                                <span className="addon-price">
                                  {`+₹${Number(displayPrice).toFixed(0)}`}
                                </span>
                                {(gramsVisible || (caloriesVisible && resolved.calories != null)) && (
                                  <span className="addon-calories">
                                    {[
                                      gramsVisible ? `${resolved.grams}g` : null,
                                      caloriesVisible && resolved.calories != null ? `${servingKcal} kcal` : null
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                )}
                              </div>
                              <div className="addon-qty-selector" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="addon-qty-btn"
                                  aria-label={`Decrease ${addon.name}`}
                                  disabled={selectedQty <= 0}
                                  onClick={() =>
                                    setAddonQuantity(
                                      { ...resolved, basePrice: catalogPrice, price: catalogPrice },
                                      selectedQty - 1,
                                      group.category
                                    )
                                  }
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="addon-qty-value">{selectedQty}</span>
                                <button
                                  type="button"
                                  className="addon-qty-btn"
                                  aria-label={`Increase ${addon.name}`}
                                  disabled={!canAddMore}
                                  onClick={() =>
                                    setAddonQuantity(
                                      { ...resolved, basePrice: catalogPrice, price: catalogPrice },
                                      selectedQty + 1,
                                      group.category
                                    )
                                  }
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {detailTabs.length > 0 && (
              <div className="details-section tabs-section">
                <div className="tabs-header">
                  {detailTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`tab-toggle-btn ${activeTab === tab ? "active" : ""}`}
                    >
                      {tab === "nutrition" ? "NUTRIENTS" : tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="tab-content">
                  {activeTab === "nutrition" && nutrientsVisible && (
                    <table className="nutrition-table">
                      <tbody>
                        {isCookiesCategory(item) ? (
                          <>
                            <tr>
                              <td>Serving Size</td>
                              <td>
                                {item.serving_size != null && item.serving_size !== ""
                                  ? Number(item.serving_size)
                                  : "—"}
                                {item.serving_weight_g != null && item.serving_weight_g !== ""
                                  ? ` (${Number(item.serving_weight_g)} g)`
                                  : ""}
                              </td>
                            </tr>
                            {(item.calories != null && Number(item.calories) > 0) ||
                            (Array.isArray(item.sizes) &&
                              item.sizes.some((s) => s?.calories != null)) ? (
                              <tr>
                                <td>Calories</td>
                                <td>
                                  {item.sizes?.[0]?.calories != null
                                    ? `${Number(item.sizes[0].calories)} kcal`
                                    : `${Number(item.calories)} kcal`}
                                </td>
                              </tr>
                            ) : null}
                            <tr>
                              <td>Total Fat</td>
                              <td>
                                {item.fats != null && item.fats !== ""
                                  ? `${Number(item.fats)}g`
                                  : "—"}
                              </td>
                            </tr>
                            <tr>
                              <td>Saturated Fat</td>
                              <td>
                                {item.saturated_fat != null && item.saturated_fat !== ""
                                  ? `${Number(item.saturated_fat)}g`
                                  : "—"}
                              </td>
                            </tr>
                            <tr>
                              <td>Protein</td>
                              <td>
                                {item.protein != null && item.protein !== ""
                                  ? `${Number(item.protein)}g`
                                  : "—"}
                              </td>
                            </tr>
                            <tr>
                              <td>Carbohydrate</td>
                              <td>
                                {item.carbohydrates != null && item.carbohydrates !== ""
                                  ? `${Number(item.carbohydrates)}g`
                                  : "—"}
                              </td>
                            </tr>
                            <tr>
                              <td>Sugar</td>
                              <td>
                                {item.sugar != null && item.sugar !== ""
                                  ? `${Number(item.sugar)}g`
                                  : "—"}
                              </td>
                            </tr>
                            <tr>
                              <td>Dietary Fibre</td>
                              <td>
                                {item.dietary_fibre != null && item.dietary_fibre !== ""
                                  ? `${Number(item.dietary_fibre)}g`
                                  : "—"}
                              </td>
                            </tr>
                            <tr>
                              <td>Sodium</td>
                              <td>
                                {item.sodium_mg != null && item.sodium_mg !== ""
                                  ? `${Number(item.sodium_mg)}mg`
                                  : "—"}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <>
                            <tr>
                              <td>Protein</td>
                              <td>{item.protein ?? Math.round(item.price * 1.5)}g/100g</td>
                            </tr>
                            <tr>
                              <td>Carbohydrates</td>
                              <td>{item.carbohydrates ?? Math.round(item.price * 2.2)}g/100g</td>
                            </tr>
                            <tr>
                              <td>Healthy Fats</td>
                              <td>{item.fats ?? Math.round(item.price * 0.8)}g/100g</td>
                            </tr>
                            <tr>
                              <td>Dietary Fiber</td>
                              <td>4.5g/100g</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  )}
                  {activeTab === "ingredients" && ingredientsVisible && (
                    <ul className="ingredients-list">
                      {(item.ingredients || "")
                        .split(/[,;\n]+/)
                        .map((ing) => ing.trim())
                        .filter(Boolean)
                        .map((ing, idx) => (
                            <li key={idx}>{ing}</li>
                          ))}
                      {!item.ingredients?.trim() && <li>No ingredients specified.</li>}
                    </ul>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions-footer product-details-footer">
          <div className="quantity-selector">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="qty-btn"
              disabled={quantity <= 1}
            >
              <Minus size={14} />
            </button>
            <span className="qty-value">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(maxSelectableQty, quantity + 1))}
              className="qty-btn"
              disabled={quantity >= maxSelectableQty}
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            className="modal-add-to-cart-btn btn-primary"
            onClick={handleAddToCartClick}
            disabled={!inStock}
            style={!inStock ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            {!inStock ? "Currently Unavailable" : isEditing ? "Update My Bowl" : "Add to Cart"} • ₹{finalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
