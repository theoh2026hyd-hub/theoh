"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import TermsOfServiceBlock from "../components/TermsOfServiceBlock";

export default function TermsClient() {
  const [userCoins, setUserCoins] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCoins = localStorage.getItem("theoh_coins");
      if (storedCoins) {
        setUserCoins(parseInt(storedCoins, 10));
      }
    }
  }, []);

  return (
    <div className="terms-page">
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
        activeSection="terms"
        setActiveSection={() => {}}
      />

      <main className="terms-page-main section-padding">
        <a href="/" className="terms-page-back">
          <ArrowLeft size={16} /> Back to Home
        </a>
        <h1 className="terms-page-title">Terms of Service & Delivery Policies</h1>
        <p className="terms-page-intro">
          Please read these terms carefully before placing an order with THE OH !.
        </p>
        <div className="terms-page-card">
          <TermsOfServiceBlock variant="light" />
        </div>
      </main>

      <Footer onDashboardToggle={() => {}} setActiveSection={() => {}} />
    </div>
  );
}
