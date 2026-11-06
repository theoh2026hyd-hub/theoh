import React from 'react';
import SafeImage from './SafeImage';
import SplashBrandTitle from './SplashBrandTitle';
import { BRAND_LOGO } from '../lib/productImages';

export default function SplashScreen({
  bootVisible,
  splashFade,
  showTelugu,
  onTypingComplete
}) {
  if (!bootVisible) return null;

  return (
    <div className={`splash-screen-overlay ${splashFade ? "fade-out" : ""}`}>
      <img src="/raw_premium_oats.png" alt="" className="splash-sticker splash-sticker-tl" aria-hidden="true" />
      <img src="/raw_dried_berries.png" alt="" className="splash-sticker splash-sticker-tr" aria-hidden="true" />
      <img src="/chocolate_chip_cookie.png" alt="" className="splash-sticker splash-sticker-bl" aria-hidden="true" />
      <img src="/raw_mixed_nuts.png" alt="" className="splash-sticker splash-sticker-br" aria-hidden="true" />
      <img src="/raw_organic_honey.png" alt="" className="splash-sticker splash-sticker-ml" aria-hidden="true" />
      <img src="/oatmeal_raisin_cookie.png" alt="" className="splash-sticker splash-sticker-mr" aria-hidden="true" />

      <div className="splash-center-loader">
        <div className="splash-loader-orbit">
          <div className="splash-loader-ring" />
          <SafeImage src={BRAND_LOGO} alt="THE OH !" className="splash-center-logo" hideOnError />
        </div>
        <SplashBrandTitle animate onTypingComplete={onTypingComplete} />
        <p className={`splash-brand-telugu ${showTelugu ? "active" : ""}`}>!!ఓట్స్ హాబిట్!!</p>
      </div>
    </div>
  );
}
