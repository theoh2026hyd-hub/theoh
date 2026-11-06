"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  DEFAULT_RESTAURANT_MAP_EMBED,
  DEFAULT_RESTAURANT_MAP_LINK,
  getRestaurantLocationLabel,
  getRestaurantMapEmbedUrl,
  getRestaurantMapLink
} from "../lib/restaurantLocation";
import { formatDeliveryPricingLabel } from "../lib/settings";
import { parseJsonResponse } from "../lib/fetchJson";

export default function DeliveryMapClient() {
  const [userCoins, setUserCoins] = useState(0);
  const [deskSettings, setDeskSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCoins = localStorage.getItem("theoh_coins");
      if (storedCoins) setUserCoins(parseInt(storedCoins, 10));
    }

    fetch("/api/menu")
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (data.success && data.settings) {
          setDeskSettings(data.settings);
        }
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  const deskAddress = deskSettings ? getRestaurantLocationLabel(deskSettings) : "";
  const mapLink = deskSettings ? getRestaurantMapLink(deskSettings) : DEFAULT_RESTAURANT_MAP_LINK;
  const mapEmbedSrc = deskSettings ? getRestaurantMapEmbedUrl(deskSettings) : DEFAULT_RESTAURANT_MAP_EMBED;

  return (
    <div style={{ background: "#FAF8F5", minHeight: "100vh", color: "#011E02" }}>
      <Navbar
        onCartToggle={() => {
          if (typeof window !== "undefined") window.location.href = "/cart";
        }}
        cartCount={0}
        onDashboardToggle={() => {
          if (typeof window !== "undefined") window.location.href = "/profile";
        }}
        activeDashboard={null}
        userCoins={userCoins}
        activeSection="delivery-map"
        setActiveSection={() => {}}
      />

      <main style={{ marginTop: "100px", padding: "30px 7% 80px", minHeight: "70vh" }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#011E02",
            fontSize: "0.9rem",
            fontWeight: "600",
            textDecoration: "none",
            marginBottom: "24px"
          }}
        >
          <ArrowLeft size={16} /> Back to Menu
        </a>

        <div style={{ marginBottom: "24px" }}>
          <span
            style={{
              color: "#2E7D32",
              fontSize: "0.85rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              fontWeight: "700"
            }}
          >
            Cloud Location
          </span>
          <h1
            style={{
              fontFamily: "var(--font-title)",
              fontSize: "2.5rem",
              color: "#011E02",
              margin: "8px 0 12px"
            }}
          >
            Delivery Coverage & Kitchen Map
          </h1>
          {settingsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "560px" }}>
              <div className="skeleton" style={{ height: "16px", width: "90%" }} />
              <div className="skeleton" style={{ height: "14px", width: "75%" }} />
            </div>
          ) : (
            <>
              <p style={{ color: "#1b4332", fontSize: "1rem", maxWidth: "560px", lineHeight: 1.6, margin: 0 }}>
                Pickup and delivery dispatch from our cloud kitchen at{" "}
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#011E02", fontWeight: 700 }}
                >
                  {deskAddress || "our main location"}
                </a>
                .
              </p>
              <p style={{ color: "#2d5a3d", fontSize: "0.85rem", marginTop: "10px", maxWidth: "560px" }}>
                We deliver within a {(deskSettings && Number(deskSettings.delivery_max_km)) || 50} km radius of our kitchen in Hyderabad.
                Delivery charges: {formatDeliveryPricingLabel(deskSettings || {})}.
              </p>
            </>
          )}
        </div>

        <div
          className="footer-delivery-map-frame"
          style={{
            maxWidth: "960px",
            margin: "0 auto 20px",
            border: "2px solid #2E7D32",
            borderRadius: "16px",
            overflow: "hidden"
          }}
        >
          {settingsLoading ? (
            <div className="skeleton" style={{ height: "480px", width: "100%" }} />
          ) : (
            <iframe
              src={mapEmbedSrc}
              width="100%"
              height="480"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              title={`THE OH ! Cloud Location${deskAddress ? ` - ${deskAddress}` : ""}`}
            />
          )}
        </div>

        <a
          href={mapLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#ffffff",
            background: "#011E02",
            padding: "12px 24px",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "0.9rem",
            textDecoration: "none"
          }}
        >
          <MapPin size={16} /> Open in Google Maps
        </a>
      </main>

      <Footer onDashboardToggle={() => {}} setActiveSection={() => {}} />
    </div>
  );
}
