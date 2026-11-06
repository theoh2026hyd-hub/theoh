"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, ChevronRight, ChevronLeft, ShoppingBag } from "lucide-react";
import { DEFAULT_SIZE_LABEL, buildCustomizeSizeOptions, getCustomizeAddonUnitPrice, getAddonUnitLabel } from "../lib/productSizes";
import { getCaloriesForSize, getAddonServingCalories, ADDON_PORTION_GRAMS } from "../lib/productCalories";
import { lookupAddonCalories } from "../lib/addonCalories";
import { computeAddonsTotal, getAddonQuantity, groupAddonsByCategory, canIncrementAddon, isAddonBlocked, isSingleSelectAddonCategory, getAddonCategoryQuantityLimit, getSelectedQtyInCategory, getAddonCategoryHint } from "../lib/addonHelpers";
import { resolveProductImage } from "../lib/productImages";
import SafeImage from "./SafeImage";
import { useOverlayBack, dismissOverlayHistory } from "../lib/overlayHistory";

function resolveAddon(addon) {
  const caloriesPer100g = addon.calories ?? lookupAddonCalories(addon.name);
  const portionGrams = addon.grams != null ? parseInt(addon.grams, 10) : ADDON_PORTION_GRAMS;
  return {
    ...addon,
    grams: Number.isFinite(portionGrams) && portionGrams > 0 ? portionGrams : ADDON_PORTION_GRAMS,
    calories: caloriesPer100g ?? addon.calories ?? null
  };
}

export default function BowlBuilderModal({
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
  const [currentStep, setCurrentStep] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [mainImage, setMainImage] = useState(resolveProductImage(item.image, item.category, item.name));
  const [selectedSizeLabel, setSelectedSizeLabel] = useState(
    cartLine?.sizeLabel === "Large" || initialSizeLabel === "Large" ? "Large" : "Medium"
  );

  const isEditing = cartLine != null && typeof onUpdateCartLine === "function";

  const addonsList = item.addons || [];
  const addonGroups = useMemo(() => groupAddonsByCategory(addonsList), [addonsList]);

  const sizes = useMemo(() => {
    const raw =
      Array.isArray(item.sizes) && item.sizes.length > 0
        ? item.sizes
        : [{ label: DEFAULT_SIZE_LABEL, price: parseFloat(item.price) || 0 }];
    return buildCustomizeSizeOptions(item, raw);
  }, [item]);

  const selectedSize =
    sizes.find((s) => s.label === selectedSizeLabel) || sizes[0] || {
      label: "Medium",
      price: 0,
    };

  const steps = useMemo(() => {
    return [
      { id: "size", label: "Base Size" },
      ...addonGroups.map(group => ({ id: group.category, label: group.category, items: group.addons })),
      { id: "review", label: "Review" }
    ];
  }, [addonGroups]);

  useEffect(() => {
    setQuantity(cartLine?.quantity ?? 1);
    setSelectedAddons(
      (cartLine?.selectedAddons || []).map((addon) => {
        const resolved = resolveAddon(addon);
        const basePrice = Number(addon.basePrice ?? addon.price) || 0;
        const sizeLabel = cartLine?.sizeLabel || initialSizeLabel || "Medium";
        return {
          ...resolved,
          basePrice,
          price: getCustomizeAddonUnitPrice(
            { ...resolved, basePrice, category: addon.category || addon.categoryName },
            sizeLabel
          ),
          quantity: Math.max(1, getAddonQuantity(addon) || 1),
        };
      })
    );
    setMainImage(resolveProductImage(item.image, item.category, item.name));
    const preferredLabel = cartLine?.sizeLabel || initialSizeLabel;
    setSelectedSizeLabel(preferredLabel === "Large" ? "Large" : "Medium");
  }, [item, cartLine, initialSizeLabel]);

  useEffect(() => {
    setSelectedAddons((prev) =>
      prev.map((addon) => {
        const basePrice = Number(addon.basePrice ?? addon.price) || 0;
        return {
          ...addon,
          basePrice,
          price: getCustomizeAddonUnitPrice({ ...addon, basePrice }, selectedSizeLabel),
        };
      })
    );
  }, [selectedSizeLabel]);

  const getSelectedQty = (addonName) => {
    const match = selectedAddons.find((entry) => entry.name === addonName);
    return getAddonQuantity(match);
  };

  const setAddonQuantity = (addon, nextQty, categoryName = "") => {
    const cat = categoryName || addon.category || addon.categoryName || "";
    const catalogPrice = Number(addon.basePrice ?? addon.price) || 0;
    const resolved = {
      ...resolveAddon(addon),
      category: cat,
      categoryName: cat,
      basePrice: catalogPrice,
      price: getCustomizeAddonUnitPrice(
        { ...addon, basePrice: catalogPrice, category: cat, categoryName: cat },
        selectedSizeLabel
      ),
    };
    let qty = Math.max(0, Math.min(99, parseInt(nextQty, 10) || 0));

    setSelectedAddons((prev) => {
      const currentQty = prev.find((entry) => entry.name === resolved.name)?.quantity || 0;
      const without = prev.filter((entry) => entry.name !== resolved.name);

      if (qty <= 0) return without;

      if (qty > currentQty && !canIncrementAddon(resolved, prev, cat, { enforceLimits: true })) {
        return prev;
      }

      if (isSingleSelectAddonCategory(cat)) {
        qty = 1;
      }

      const limit = getAddonCategoryQuantityLimit(cat, { enforceLimits: true });
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
  const availableQty = item.stockQuantity != null ? parseInt(item.stockQuantity, 10) : item.quantity != null ? parseInt(item.quantity, 10) : null;
  const inStock = (availableQty == null || availableQty > 0) && item.inStock !== false && item.in_stock !== false;
  const selectedCalories =
    selectedSize.calories ??
    getCaloriesForSize(item.calories, selectedSize.label, item.sizeCaloriesRaw);

  const handleClose = () => {
    onClose();
    if (manageHistory) dismissOverlayHistory();
  };

  const handleAddToCartClick = () => {
    if (!inStock) return;
    const payload = {
      ...item,
      price: selectedSize.price,
      sizeLabel: selectedSize.label,
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

  useOverlayBack(manageHistory, "bowl-builder", onClose);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction < 0 ? 100 : -100, opacity: 0 })
  };

  const [direction, setDirection] = useState(0);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="modal-overlay bowl-builder-overlay" onClick={handleClose}>
      <div className="bowl-builder-container glass-effect" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bowl-builder-header">
          <div className="header-top">
            <span className="bowl-tag">Craft Your Own</span>
            <button className="modal-close-btn" onClick={handleClose}>
              <X size={20} />
            </button>
          </div>
          <h2 className="bowl-title">{item.name}</h2>
          
          <div className="step-indicators">
            {steps.map((step, idx) => (
              <div 
                key={step.id} 
                className={`step-dot ${idx === currentStep ? "active" : idx < currentStep ? "completed" : ""}`}
                onClick={() => {
                  setDirection(idx > currentStep ? 1 : -1);
                  setCurrentStep(idx);
                }}
              />
            ))}
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div className="bowl-step-content-wrapper">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bowl-step-content"
            >
              
              {currentStepData.id === "size" && (
                <div className="builder-size-step">
                  <h3>Choose Your Base Size</h3>
                  <p className="details-size-customize-note">
                    Large adds ₹15 to each oat base price.
                  </p>
                  <div className="builder-size-grid details-size-options details-size-options-customize">
                    {sizes.map(sizeOption => {
                      const cals =
                        sizeOption.calories ??
                        getCaloriesForSize(item.calories, sizeOption.label, item.sizeCaloriesRaw);
                      return (
                        <button
                          key={sizeOption.label}
                          className={`builder-size-card details-size-btn-label-only ${selectedSize.label === sizeOption.label ? "active" : ""}`}
                          onClick={() => setSelectedSizeLabel(sizeOption.label)}
                        >
                          <span className="size-label">{sizeOption.label}</span>
                          <span className="size-meta">
                            {sizeOption.grams && `${sizeOption.grams}g`} 
                            {cals && sizeOption.grams && ' · '} 
                            {cals && `${cals} kcal`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentStepData.items && (
                <div className="builder-addon-step">
                  <h3>Add {currentStepData.label}</h3>
                  {getAddonCategoryHint(currentStepData.label, { enforceLimits: true }) && (
                    <p className="addon-group-hint">
                      {getAddonCategoryHint(currentStepData.label, { enforceLimits: true })}
                      {getAddonCategoryQuantityLimit(currentStepData.label, { enforceLimits: true }) != null
                        ? ` (${getSelectedQtyInCategory(selectedAddons, currentStepData.label)}/${getAddonCategoryQuantityLimit(currentStepData.label, { enforceLimits: true })} selected)`
                        : ""}
                    </p>
                  )}
                  <div className="builder-addon-grid">
                    {currentStepData.items.map(addon => {
                      const catalogPrice = Number(addon.price) || 0;
                      const resolved = resolveAddon({
                        ...addon,
                        category: currentStepData.label,
                        categoryName: currentStepData.label,
                        basePrice: catalogPrice,
                        price: catalogPrice,
                      });
                      const selectedQty = getSelectedQty(addon.name);
                      const isSelected = selectedQty > 0;
                      const blocked = isAddonBlocked(resolved, selectedAddons, currentStepData.label, { enforceLimits: true });
                      const canAddMore = canIncrementAddon(resolved, selectedAddons, currentStepData.label, { enforceLimits: true });
                      const displayPrice = getCustomizeAddonUnitPrice(
                        {
                          ...resolved,
                          basePrice: catalogPrice,
                          category: currentStepData.label,
                          categoryName: currentStepData.label,
                        },
                        selectedSizeLabel
                      );
                      const addonUnit = getAddonUnitLabel(addon);
                      return (
                        <div
                          key={addon.id || addon.name}
                          className={`builder-addon-card ${isSelected ? "selected" : ""}${
                            blocked && !isSelected ? " addon-card-blocked" : ""
                          }`}
                        >
                          <div className="addon-info">
                            <span className="addon-name">{addon.name}</span>
                            <span className="addon-price">
                              {addonUnit
                                ? `+₹${Number(displayPrice).toFixed(0)} / ${addonUnit}`
                                : `+₹${Number(displayPrice).toFixed(0)}`}
                            </span>
                          </div>
                          
                          {isSelected ? (
                            <div className="addon-qty-selector">
                              <button onClick={() => setAddonQuantity({ ...resolved, basePrice: catalogPrice, price: catalogPrice }, selectedQty - 1, currentStepData.label)}><Minus size={14} /></button>
                              <span>{selectedQty}</span>
                              <button
                                disabled={!canAddMore}
                                onClick={() => setAddonQuantity({ ...resolved, basePrice: catalogPrice, price: catalogPrice }, selectedQty + 1, currentStepData.label)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="addon-add-btn"
                              disabled={blocked}
                              onClick={() => setAddonQuantity({ ...resolved, basePrice: catalogPrice, price: catalogPrice }, 1, currentStepData.label)}
                            >
                              <Plus size={16} /> Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentStepData.id === "review" && (
                <div className="builder-review-step">
                  <h3>Review Your Bowl</h3>
                  <div className="review-summary-card">
                    <div className="review-row base-row">
                      <span>{item.name} ({selectedSize.label})</span>
                      <span>₹{Number(selectedSize.price).toFixed(0)}</span>
                    </div>
                    {selectedAddons.length > 0 ? (
                      <div className="review-addons-list">
                        {selectedAddons.map(addon => (
                          <div key={addon.name} className="review-row">
                            <span className="muted-text">
                              + {addon.name} {addon.quantity > 1 ? `x${addon.quantity}` : ""}
                            </span>
                            <span>₹{(Number(addon.price) * addon.quantity).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="review-row muted-text">No extra toppings added.</div>
                    )}
                    <div className="review-divider"></div>
                    <div className="review-row total-row">
                      <span>Total Price (x{quantity})</span>
                      <span>₹{finalPrice.toFixed(0)}</span>
                    </div>
                  </div>
                  
                  <div className="bowl-qty-control">
                    <span>How many bowls?</span>
                    <div className="qty-selector">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}><Minus size={16}/></button>
                      <span>{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)}><Plus size={16}/></button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Sticky Footer */}
        <div className="bowl-builder-footer">
          <div className="footer-price-info">
            <span className="price-label">Current Total</span>
            <span className="price-value">₹{finalPrice.toFixed(0)}</span>
          </div>
          <div className="footer-actions">
            {currentStep > 0 && (
              <button className="nav-btn prev-btn" onClick={prevStep}>
                <ChevronLeft size={20} />
              </button>
            )}
            
            {currentStep < steps.length - 1 ? (
              <button className="nav-btn next-btn" onClick={nextStep}>
                Next <ChevronRight size={20} />
              </button>
            ) : (
              <button className="nav-btn finish-btn" onClick={handleAddToCartClick} disabled={!inStock}>
                <ShoppingBag size={18} /> {isEditing ? "Update Cart" : "Add to Cart"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
