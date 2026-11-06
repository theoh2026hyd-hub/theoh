"use client";

import { useState, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { markAppBootComplete } from "../lib/appBoot";
import { ShoppingBag, User, Menu, X, Coins, Volume2, VolumeX } from "lucide-react";
import SafeImage from "./SafeImage";
import { BRAND_LOGO } from "../lib/productImages";
import BrandName from "./BrandName";
import { useSiteAudio } from "./SiteAudioProvider";

export default function Navbar({ 
  onCartToggle, 
  cartCount, 
  onDashboardToggle, 
  activeDashboard, 
  userCoins,
  coinsLoading = false,
  isLoggedIn = false,
  activeSection,
  setActiveSection,
  onSectionNavigate
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { hasAudio, muted, toggleMute } = useSiteAudio();

  useLayoutEffect(() => {
    if (pathname !== "/") {
      markAppBootComplete();
    }
  }, [pathname]);

  useLayoutEffect(() => {
    let ticking = false;

    const syncScrollState = () => {
      const nextScrolled = window.scrollY > 50;
      setIsScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        syncScrollState();
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncScrollState();
      }
    };

    syncScrollState();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pageshow", syncScrollState);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pageshow", syncScrollState);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname]);

  const navLinks = [
    { name: "Home", id: "home" },
    { name: "Menu", id: "menu" },
    { name: "Our Craft", id: "about" },
    { name: "Connect", id: "contact" },
    { name: "Updates", id: "updates" },
    { name: "Why", id: "why-us", useBrand: true },
  ];

  const handleLinkClick = (id) => {
    setMobileMenuOpen(false);
    if (id === "updates") {
      if (typeof window !== "undefined") {
        window.location.assign("/updates");
      }
      return;
    }
    if (id === "why-us") {
      if (typeof window !== "undefined") {
        window.location.assign("/why-us");
      }
      return;
    }
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      // Land directly on the section — home page deep-link handler jumps instantly.
      const target = id === "home" ? "/" : `/?section=${id}`;
      window.location.assign(target);
      return;
    }
    if (onSectionNavigate) {
      onSectionNavigate(id);
      return;
    }
    if (onDashboardToggle) onDashboardToggle(null);
    if (setActiveSection) setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const navClass =
    !isHome || isScrolled || activeSection !== "home" ? "scrolled" : "hero-transparent";

  return (
    <header className={`navbar-wrapper ${navClass} ${mobileMenuOpen ? "mobile-open" : ""}`}>
      <div className="navbar-container">
        {/* Brand Logo */}
        <div className="navbar-logo" onClick={() => handleLinkClick("home")}>
          <SafeImage src={BRAND_LOGO} alt="THE OH !" className="navbar-logo-img" hideOnError />
          <div className="navbar-logo-text">
            <BrandName inline={false} showTelugu />
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="desktop-nav">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleLinkClick(link.id)}
              className={`nav-link ${activeSection === link.id && !activeDashboard ? "active" : ""}`}
            >
              {link.useBrand ? (
                <>
                  {link.name} <BrandName className="brand-name-inline--nav" />
                </>
              ) : (
                link.name
              )}
              <span className="underline-hover"></span>
            </button>
          ))}
        </nav>

        {/* Utility Controls */}
        <div className="navbar-actions">
          {isLoggedIn && (
            <div className="loyalty-indicator" title="Your reward coins balance" style={{ display: "flex", alignItems: "center" }}>
              <Coins size={18} style={{ color: "#C9A227", marginRight: "5px" }} />
              <span className="coin-count" style={{ color: "#C9A227", fontWeight: "700", minWidth: "1.25rem" }}>
                {coinsLoading ? "…" : userCoins}
              </span>
            </div>
          )}

          {/* User Dashboard Trigger — desktop only (mobile: hamburger menu) */}
          <button 
            className={`action-btn navbar-profile-btn ${activeDashboard === "user" ? "active" : ""}`}
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/profile";
              }
            }}
            title="User Dashboard"
          >
            <User size={20} />
          </button>

          {/* Cart Icon Trigger */}
          <button 
            className="action-btn cart-btn" 
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/cart";
              }
            }} 
            title="Shopping Cart"
          >
            <ShoppingBag size={20} style={{ color: "#ffffff" }} />
            {cartCount > 0 && <span className="cart-badge" style={{ color: "#000000", backgroundColor: "#ffffff", borderColor: "#ffffff" }}>{cartCount}</span>}
          </button>

          {hasAudio && (
            <button
              type="button"
              className={`action-btn site-audio-toggle-btn${muted ? " is-muted" : " is-playing"}`}
              onClick={toggleMute}
              title={muted ? "Play background music" : "Mute background music"}
              aria-label={muted ? "Play background music" : "Mute background music"}
            >
              {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? "open" : ""}`}>
        <nav className="mobile-nav-links">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleLinkClick(link.id)}
              className={`mobile-nav-link ${activeSection === link.id && !activeDashboard ? "active" : ""}`}
            >
              {link.useBrand ? (
                <>
                  {link.name} <BrandName className="brand-name-inline--nav" />
                </>
              ) : (
                link.name
              )}
            </button>
          ))}
          <div className="mobile-actions-divider"></div>
          <button 
            className="mobile-drawer-btn" 
            onClick={() => {
              setMobileMenuOpen(false);
              if (typeof window !== "undefined") {
                window.location.href = "/profile";
              }
            }}
          >
            <User size={18} /> My Profile
          </button>
          {hasAudio && (
            <button
              type="button"
              className="mobile-drawer-btn"
              onClick={() => {
                toggleMute();
              }}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              {muted ? "Play Music" : "Mute Music"}
            </button>
          )}

        </nav>
      </div>
    </header>
  );
}
