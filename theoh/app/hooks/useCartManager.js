import { useState, useCallback } from "react";
import { DEFAULT_SIZE_LABEL } from "../lib/productSizes";
import { getCaloriesForSize } from "../lib/productCalories";
import { getGramsForSize } from "../lib/productPortions";
import { resolveProductImage } from "../lib/productImages";
import { upsertGuestCartLine } from "../lib/pendingCartAction";

export function useCartManager({ isProfileComplete, requireLoginForAction }) {
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const normalizeAddonKey = useCallback((addons = []) => {
    return [...addons]
      .map((a) => `${a.name}::${Number(a.price)}::${Math.max(1, parseInt(a.quantity, 10) || 1)}`)
      .sort()
      .join("|");
  }, []);

  const computeAddonsTotal = useCallback((addons = []) => {
    return addons.reduce((sum, a) => {
      const qty = Math.max(1, parseInt(a.quantity, 10) || 1);
      return sum + parseFloat(a.price || 0) * qty;
    }, 0);
  }, []);

  const buildCartLine = useCallback((item, overrides = {}) => {
    const selectedAddons = Array.isArray(overrides.selectedAddons)
      ? overrides.selectedAddons
      : Array.isArray(item.selectedAddons)
      ? item.selectedAddons
      : [];
    const cartQuantity = overrides.quantity != null ? parseInt(overrides.quantity, 10) || 1 : 1;
    const sizeLabel = overrides.sizeLabel ?? item.sizeLabel ?? DEFAULT_SIZE_LABEL;
    const unitPrice = overrides.price ?? item.price;
    const matchedSize = item.sizes?.find((size) => size.label === sizeLabel);
    const portionGrams =
      overrides.portionGrams ??
      matchedSize?.grams ??
      getGramsForSize(item.sizeGramsRaw, sizeLabel);
    const stockQuantity = item.stockQuantity ?? item.quantity ?? null;

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
      stockQuantity: stockQuantity != null ? parseInt(stockQuantity, 10) : null,
      image: resolveProductImage(
        overrides.image ?? item.image,
        overrides.category ?? item.category,
        overrides.name ?? item.name
      ),
      category: overrides.category ?? item.category,
      quantity: cartQuantity
    };
  }, [computeAddonsTotal]);

  const cartLineKey = useCallback((line) => {
    return `${Number(line.id)}|${line.sizeLabel || DEFAULT_SIZE_LABEL}|${normalizeAddonKey(line.selectedAddons)}`;
  }, [normalizeAddonKey]);

  const findCartLineIndexBySize = useCallback((currentCart, itemId, sizeLabel, selectedAddons = []) => {
    const normalizedSize = sizeLabel || DEFAULT_SIZE_LABEL;
    const probe = {
      id: Number(itemId),
      sizeLabel: normalizedSize,
      selectedAddons: selectedAddons ?? []
    };
    const exactIdx = currentCart.findIndex((line) => cartLineKey(line) === cartLineKey(probe));
    if (exactIdx > -1) return exactIdx;

    const plainIdx = currentCart.findIndex(
      (line) =>
        Number(line.id) === Number(itemId) &&
        (line.sizeLabel || DEFAULT_SIZE_LABEL) === normalizedSize &&
        (!line.selectedAddons || line.selectedAddons.length === 0)
    );
    if (plainIdx > -1) return plainIdx;

    return currentCart.findIndex(
      (line) =>
        Number(line.id) === Number(itemId) &&
        (line.sizeLabel || DEFAULT_SIZE_LABEL) === normalizedSize
    );
  }, [cartLineKey]);

  const addItemToCart = useCallback((item, details = null) => {
    const source = details || item;
    if (source.inStock === false || source.in_stock === false) return;

    const newItem = buildCartLine(item, {
      selectedAddons: source.selectedAddons,
      quantity: details ? (source.quantity || 1) : 1,
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
  }, [buildCartLine, cartLineKey]);

  const handleAddToCart = useCallback((item, details = null) => {
    if (!isProfileComplete) {
      const source = details || item;
      if (source.inStock === false || source.in_stock === false) return;
      const line = buildCartLine(item, {
        selectedAddons: source.selectedAddons,
        quantity: details ? (source.quantity || 1) : 1,
        price: source.price ?? item.price,
        sizeLabel: source.sizeLabel || item.sizeLabel || DEFAULT_SIZE_LABEL,
        portionGrams: source.portionGrams,
        calories: source.calories
      });
      upsertGuestCartLine(line, cartLineKey);
      requireLoginForAction();
      return;
    }
    addItemToCart(item, details);
  }, [isProfileComplete, buildCartLine, upsertGuestCartLine, cartLineKey, requireLoginForAction, addItemToCart]);

  const handleReplaceCartItem = useCallback((index, item) => {
    const newItem = buildCartLine(item, {
      selectedAddons: item.selectedAddons,
      quantity: item.quantity || 1
    });
    setCart((prevCart) => {
      const updated = [...prevCart];
      updated[index] = newItem;
      return updated;
    });
  }, [buildCartLine]);

  const handleUpdateQty = useCallback((index, newQty) => {
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
  }, []);

  const incrementItemInCart = useCallback((item, sizeLabel = DEFAULT_SIZE_LABEL, price = null, selectedAddons = []) => {
    if (item.inStock === false || item.in_stock === false) return;
    const stockCap = item.stockQuantity != null
      ? parseInt(item.stockQuantity, 10)
      : item.quantity != null
      ? parseInt(item.quantity, 10)
      : null;

    setCart((prevCart) => {
      const currentTotal = prevCart
        .filter((line) => line.id === item.id)
        .reduce((sum, line) => sum + (line.quantity || 0), 0);
      if (stockCap != null && currentTotal >= stockCap) return prevCart;

      const idx = findCartLineIndexBySize(prevCart, item.id, sizeLabel, selectedAddons);
      if (idx > -1) {
        const updated = [...prevCart];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + 1
        };
        return updated;
      }

      const line = buildCartLine(item, {
        sizeLabel,
        price: price ?? item.price,
        selectedAddons: selectedAddons ?? [],
        quantity: 1
      });
      return [...prevCart, line];
    });
  }, [findCartLineIndexBySize, buildCartLine]);

  const handleIncrementQty = useCallback((item, sizeLabel = DEFAULT_SIZE_LABEL, price = null, selectedAddons = []) => {
    if (!isProfileComplete) {
      if (item.inStock === false || item.in_stock === false) return;
      const line = buildCartLine(item, {
        sizeLabel,
        price: price ?? item.price,
        selectedAddons: selectedAddons ?? [],
        quantity: 1
      });
      upsertGuestCartLine(line, cartLineKey);
      requireLoginForAction();
      return;
    }
    incrementItemInCart(item, sizeLabel, price, selectedAddons);
  }, [isProfileComplete, buildCartLine, upsertGuestCartLine, cartLineKey, requireLoginForAction, incrementItemInCart]);

  const handleDecrementQty = useCallback((item, sizeLabel = DEFAULT_SIZE_LABEL, price = null, selectedAddons = []) => {
    setCart((prevCart) => {
      const idx = findCartLineIndexBySize(prevCart, item.id, sizeLabel, selectedAddons);
      if (idx > -1) {
        const updated = [...prevCart];
        if (updated[idx].quantity > 1) {
          updated[idx] = {
            ...updated[idx],
            quantity: updated[idx].quantity - 1
          };
          return updated;
        }
        return updated.filter((_, i) => i !== idx);
      }
      return prevCart;
    });
  }, [findCartLineIndexBySize]);

  const handleRemoveCartItem = useCallback((index) => {
    setCart((prevCart) => prevCart.filter((_, idx) => idx !== index));
  }, []);

  return {
    cart,
    setCart,
    cartOpen,
    setCartOpen,
    buildCartLine,
    cartLineKey,
    handleAddToCart,
    handleReplaceCartItem,
    handleUpdateQty,
    handleIncrementQty,
    handleDecrementQty,
    handleRemoveCartItem
  };
}
