"use client";

import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import UserDashboard from "../components/UserDashboard";
import { useAuth } from "../hooks/useAuth";
import { readUserCart } from "../lib/userSessionStorage";
import { parseJsonResponse } from "../lib/fetchJson";
import ErrorPage from "../components/errors/ErrorPage";
import ErrorState from "../components/errors/ErrorState";

export default function ProfileClient() {
  const { user, isProfileComplete, loading: authLoading, isLoggedIn } = useAuth();
  const [userCoins, setUserCoins] = useState(0);
  const [orderHistory, setOrderHistory] = useState([]);
  const [syncedPhone, setSyncedPhone] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [cart, setCart] = useState([]);
  const [profileBootReady, setProfileBootReady] = useState(false);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setUserCoins(0);
      setOrderHistory([]);
      setSyncedPhone("");
      setCart([]);
      setProfileBootReady(true);
      return;
    }

    if (!isProfileComplete) {
      setProfileBootReady(true);
      return;
    }

    setCart(readUserCart(user.id));
    setProfileBootReady(false);

    fetch("/api/user", { cache: "no-store" })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!data.success) return;
        setUserCoins(data.wallet.balance);
        setOrderHistory(data.orders || []);
        setSyncedPhone(data.wallet.phone || "");
        if (Array.isArray(data.wallet.favorites)) {
          setFavorites(data.wallet.favorites);
        }
      })
      .catch((err) => {
        console.error("Error refreshing profile:", err);
        setProfileError(true);
      })
      .finally(() => setProfileBootReady(true));
  }, [authLoading, isProfileComplete, user?.id]);

  useEffect(() => {
    const syncCartFromStorage = () => {
      if (!isProfileComplete || !user?.id) {
        setCart([]);
        return;
      }
      setCart(readUserCart(user.id));
    };
    window.addEventListener("theoh-cart-update", syncCartFromStorage);
    window.addEventListener("theoh-session-cleared", syncCartFromStorage);
    return () => {
      window.removeEventListener("theoh-cart-update", syncCartFromStorage);
      window.removeEventListener("theoh-session-cleared", syncCartFromStorage);
    };
  }, [isProfileComplete, user?.id]);

  const handleFetchProfile = (coins, history, phone, dbFavorites) => {
    setUserCoins(coins);
    setOrderHistory(history);
    setSyncedPhone(phone);
    if (typeof window !== "undefined") {
      localStorage.setItem("theoh_coins", String(coins || 0));
      if (phone) localStorage.setItem("theoh_phone", phone);
    }
    if (dbFavorites) {
      setFavorites(dbFavorites);
    }
  };

  const isProfileLoading = authLoading || (isProfileComplete && !profileBootReady);

  return (
    <div className="app-container">
      <Navbar 
        onCartToggle={() => {
          if (typeof window !== "undefined") {
            window.location.href = "/cart";
          }
        }} 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onDashboardToggle={() => {}}
        activeDashboard="user"
        userCoins={userCoins}
        isLoggedIn={isLoggedIn || isProfileComplete}
        activeSection="profile"
        setActiveSection={() => {}}
      />
      <main className="profile-page-main">
        {isProfileLoading ? (
          <div className="menu-catalog-loading" aria-live="polite" aria-busy="true">
            <div className="loading-spinner-luxury" aria-hidden="true" />
          </div>
        ) : profileError && !profileBootReady ? (
          <ErrorState
            title="Unable to Load Profile"
            description="We couldn't load your profile right now. Please try again."
            variant="api"
            onRetry={() => window.location.reload()}
          />
        ) : (
          <UserDashboard
            userCoins={userCoins} 
            orderHistory={orderHistory} 
            onFetchProfile={handleFetchProfile}
            activePhone={syncedPhone}
          />
        )}
      </main>
      <Footer onDashboardToggle={() => {}} setActiveSection={() => {}} />
    </div>
  );
}
