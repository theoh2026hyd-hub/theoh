"use client";

import SafeImage from "./SafeImage";
import { BRAND_LOGO } from "../lib/productImages";

export default function HeroBrandLogo() {
  return (
    <div className="hero-brand-audio">
      <div className="hero-brand-logo-btn" aria-hidden="true">
        <SafeImage src={BRAND_LOGO} alt="THE OH ! Logo" className="hero-brand-logo" hideOnError />
      </div>
    </div>
  );
}
