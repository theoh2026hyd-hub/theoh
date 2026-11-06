"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const MAP_EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2176.759046307852!2d78.3829686878301!3d17.415276817617045!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb97ce8c1bc02d%3A0x142c743f6aa4fd7b!2sMalkam%20Cheruvu%20Heritage%20Rocks!5e1!3m2!1sen!2sin!4v1782739271257!5m2!1sen!2sin";

const MAP_LINK =
  "https://www.google.com/maps/place/Malkam+Cheruvu+Heritage+Rocks";

export default function DeliveryMapPage() {
  const [userCoins, setUserCoins] = useState(0);
  const [deskAddress, setDeskAddress] = useState("Malkam Cheruvu Heritage Rocks, Hyderabad, Telangana, India");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCoins = localStorage.getItem("theoh_coins");
      if (storedCoins) setUserCoins(parseInt(storedCoins, 10));
    }

    fetch("/api/menu")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings?.restaurant_address) {
          setDeskAddress(data.settings.restaurant_address);
        }
      })
      .catch(() => {});
  }, []);

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
            Kitchen Location
          </span>
          <h1
            style={{
              fontFamily: "var(--font-title)",
              fontSize: "2.5rem",
              color: "#011E02",
              margin: "8px 0 12px"
            }}
          >
            Delivery Map
          </h1>
          <p style={{ color: "#1b4332", fontSize: "1rem", maxWidth: "560px", lineHeight: 1.6, margin: 0 }}>
            Pickup and delivery dispatch from our kitchen at{" "}
            <strong style={{ color: "#011E02" }}>{deskAddress}</strong>.
          </p>
          <p style={{ color: "#2d5a3d", fontSize: "0.85rem", marginTop: "10px", maxWidth: "560px" }}>
            Delivery charges: ₹100 for up to 3 km from this location, then ₹15 for each additional km.
          </p>
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
          <iframe
            src={MAP_EMBED_SRC}
            width="100%"
            height="480"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            title="THE OH ! Kitchen Location - Malkam Cheruvu Heritage Rocks"
          />
        </div>

        <a
          href={MAP_LINK}
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
