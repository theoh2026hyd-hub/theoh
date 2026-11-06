"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import { readUserCart } from "@/app/lib/userSessionStorage";
import { readCheckoutResumeDraft } from "@/app/lib/checkoutResume";

export function notifyCartUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("theoh-cart-update"));
  }
}

export default function CartFloatingBar() {
  const pathname = usePathname();
  const { user, isProfileComplete } = useAuth();
  const [cart, setCart] = useState([]);
  const [resumeDraft, setResumeDraft] = useState(null);

  useEffect(() => {
    const syncCart = () => {
      if (!isProfileComplete || !user?.id) {
        setCart([]);
        return;
      }
      const nextCart = readUserCart(user.id);
      setCart((prev) =>
        JSON.stringify(prev) === JSON.stringify(nextCart) ? prev : nextCart
      );
    };
    const syncResumeDraft = () => {
      setResumeDraft(readCheckoutResumeDraft());
    };
    syncCart();
    syncResumeDraft();
    window.addEventListener("theoh-cart-update", syncCart);
    window.addEventListener("theoh-cart-update", syncResumeDraft);
    window.addEventListener("theoh-checkout-resume-change", syncResumeDraft);
    window.addEventListener("theoh-session-cleared", syncCart);
    window.addEventListener("theoh-session-cleared", syncResumeDraft);
    window.addEventListener("storage", syncCart);
    window.addEventListener("storage", syncResumeDraft);
    return () => {
      window.removeEventListener("theoh-cart-update", syncCart);
      window.removeEventListener("theoh-cart-update", syncResumeDraft);
      window.removeEventListener("theoh-checkout-resume-change", syncResumeDraft);
      window.removeEventListener("theoh-session-cleared", syncCart);
      window.removeEventListener("theoh-session-cleared", syncResumeDraft);
      window.removeEventListener("storage", syncCart);
      window.removeEventListener("storage", syncResumeDraft);
    };
  }, [isProfileComplete, user?.id]);

  const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + ((item.price || 0) + (item.addonsTotal || 0)) * (item.quantity || 1),
    0
  );

  const hiddenPaths = ["/cart", "/admin"];
  const isHidden = hiddenPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const awaitingCheckoutResume = Boolean(resumeDraft?.awaitResume);

  if (isHidden || itemCount === 0) return null;

  return (
    <button
      type="button"
      className="cart-floating-bar"
      onClick={() => {
        if (awaitingCheckoutResume) {
          if (resumeDraft.source === "cart") {
            window.location.href = "/cart";
            return;
          }
          window.location.href = "/";
          return;
        }
        window.location.href = "/cart";
      }}
      aria-label={
        awaitingCheckoutResume
          ? `Continue checkout with ${itemCount} items`
          : `View cart with ${itemCount} items`
      }
    >
      <span className="cart-floating-bar-icon">
        <ShoppingBag size={18} />
        <span className="cart-floating-bar-badge">{itemCount}</span>
      </span>
      <span className="cart-floating-bar-copy">
        <strong>{itemCount} {itemCount === 1 ? "item" : "items"}</strong>
        <span>
          ₹{subtotal.toFixed(0)} · {awaitingCheckoutResume ? "Continue checkout" : "View cart"}
        </span>
      </span>
      <ChevronRight size={18} className="cart-floating-bar-arrow" aria-hidden />
    </button>
  );
}
