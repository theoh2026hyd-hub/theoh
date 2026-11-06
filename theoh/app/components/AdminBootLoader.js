"use client";

import SplashBrandTitle from "./SplashBrandTitle";
import SafeImage from "./SafeImage";
import { BRAND_LOGO } from "../lib/productImages";

export default function AdminBootLoader({ message = "Loading console…", compact = false }) {
  if (compact) {
    return (
      <div className="admin-compact-loader-overlay" role="status" aria-live="polite" aria-busy="true">
        <div className="admin-compact-loader-spinner" aria-hidden="true" />
        {message ? <p className="admin-compact-loader-text">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="admin-boot-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="admin-boot-center">
        <div className="splash-loader-orbit admin-boot-orbit">
          <div className="splash-loader-ring" aria-hidden="true" />
          <SafeImage
            src={BRAND_LOGO}
            alt="THE OH !"
            className="splash-center-logo admin-boot-logo"
            hideOnError
          />
        </div>
        <SplashBrandTitle className="splash-brand-title admin-boot-title" />
        <p className="admin-boot-subtitle">!!ఓట్స్ హాబిట్!!</p>
        <p className="admin-boot-message">{message}</p>
      </div>
    </div>
  );
}
