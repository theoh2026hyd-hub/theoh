"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Award, Leaf, Sparkles } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function WhyUsPage() {
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
    <div className="why-us-page">
      <Navbar 
        onCartToggle={() => {
          if (typeof window !== "undefined") window.location.href = "/?section=menu";
        }} 
        cartCount={0}
        onDashboardToggle={() => {
          if (typeof window !== "undefined") window.location.href = "/?section=menu";
        }}
        activeDashboard={null}
        userCoins={userCoins}
        activeSection="why-us"
        setActiveSection={() => {}}
      />

      <main className="why-us-main">
        <section className="why-us-hero">
          <a href="/" className="why-us-back-link">
            <ArrowLeft size={16} /> Back to Menu
          </a>
          <h1 className="why-us-page-title">Why THE OH ! ?</h1>
        </section>

        <section className="why-us-section">
          <div className="why-us-section-header">
            <span className="why-us-eyebrow">The THE OH ! Difference</span>
            <h2 className="why-us-section-title">An Uncompromising Commitment to Excellence.</h2>
            <div className="why-us-divider"></div>
          </div>

          <div className="why-us-content-grid">
            <div className="why-us-image-col">
              <div className="why-us-image-card">
                <img 
                  src="/why_us_premium_oats.png" 
                  alt="Premium Oats Ingredients" 
                  className="why-us-image"
                />
                <div className="why-us-image-caption">
                  <p className="why-us-caption-label">The Art of Selection</p>
                  <p className="why-us-caption-text">Curated, heritage-grade grains and the season's finest botanicals, refined for the discerning palate.</p>
                </div>
              </div>
            </div>

            <div className="why-us-text-col">
              <p className="why-us-intro">
                At <strong>THE OH !</strong>, we believe true luxury is found in clean, elevated nutrition that honors your body's potential. We don't just prepare food; we curate vitality.
              </p>

              <div className="why-us-features">
                <div className="why-us-feature">
                  <div className="why-us-feature-icon">
                    <Leaf size={20} color="#2E7D32" />
                  </div>
                  <div className="why-us-feature-body">
                    <h4>100% Organic & Gluten-Friendly</h4>
                    <p>
                      Every ingredient is carefully selected from premium organic sources. No artificial fillers, no synthetic processing, no hidden sugars — just honest, wholesome nutrition.
                    </p>
                  </div>
                </div>

                <div className="why-us-feature">
                  <div className="why-us-feature-icon">
                    <Award size={20} color="#2E7D32" />
                  </div>
                  <div className="why-us-feature-body">
                    <h4>Nutritionist-Crafted Recipes</h4>
                    <p>
                      Every recipe is planned by nutrition experts to deliver slow-release energy, high dietary fibre, and pure protein. Ideal for your heart, digestion, and daily performance.
                    </p>
                  </div>
                </div>

                <div className="why-us-feature">
                  <div className="why-us-feature-icon">
                    <Sparkles size={20} color="#2E7D32" />
                  </div>
                  <div className="why-us-feature-body">
                    <h4>A Legacy of Honest Food</h4>
                    <p>
                      We take immense pride in crafting every Premium Oat Bowl with fresh ingredients, transparent nutrition, and flavours that respect both your palate and your body.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
