"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Award, Leaf, Sparkles } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BrandName from "../components/BrandName";

export default function WhyUsClient() {
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
          <h1 className="why-us-page-title">
            Why <BrandName /> ?
          </h1>
        </section>

        <section className="why-us-section">
          <div className="why-us-section-header">
            <span className="why-us-eyebrow">The OH ! Difference</span>
            <h2 className="why-us-section-title">An Uncompromising Commitment to Excellence.</h2>
            <div className="why-us-divider"></div>
          </div>

          <div className="why-us-content-grid">
            <div className="why-us-image-col">
              <div className="why-us-image-card">
                <img 
                  src="/why_us_premium_oats.png" 
                  alt="Premium Natural Oats Ingredients - THE OH ! Hyderabad" 
                  className="why-us-image"
                />
                <div className="why-us-image-caption">
                  <p className="why-us-caption-label">The Art of Selection</p>
                  <p className="why-us-caption-text">A thoughtful blend of premium quality ingredients, chosen for flavour, nutrition, and every bowl we serve.</p>
                </div>
              </div>
            </div>

            <div className="why-us-text-col">
              <p className="why-us-intro">
                At <strong>THE OH !</strong>, we believe true luxury is found in clean, elevated nutrition that honors your body's potential. We prepare every bowl with a thoughtful mix of premium quality ingredients.
              </p>

              <div className="why-us-features">
                <div className="why-us-feature">
                  <div className="why-us-feature-icon">
                    <Leaf size={20} color="#2E7D32" />
                  </div>
                  <div className="why-us-feature-body">
                    <h4>Premium Ingredients</h4>
                    <p>
                      We carefully select premium quality items for every recipe. Thoughtfully sourced ingredients, no synthetic processing, no added sugars, just wholesome nutrition.
                    </p>
                  </div>
                </div>

                <div className="why-us-feature">
                  <div className="why-us-feature-icon">
                    <Award size={20} color="#2E7D32" />
                  </div>
                  <div className="why-us-feature-body">
                    <h4>The Oats Habit</h4>
                    <p>
                      Making oats part of your daily routine supports steady energy, keeps you fuller for longer, and adds fibre that is good for digestion. A simple habit that helps you start mornings well and stay nourished through the day.
                    </p>
                  </div>
                </div>

                <div className="why-us-feature">
                  <div className="why-us-feature-icon">
                    <Sparkles size={20} color="#2E7D32" />
                  </div>
                  <div className="why-us-feature-body">
                    <h4>A Legacy of Wholesome Food</h4>
                    <p>
                      We take immense pride in crafting every Premium Oat Bowl with fresh premium quality ingredients, transparent nutrition, and flavours that respect both your palate and your body.
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
