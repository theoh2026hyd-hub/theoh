"use client";

import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";

const ROTATING_WORDS = ["crunch", "flavor", "bite", "blend"];

export default function HeroInteractiveText({ onCustomizeBowl, onDiscoverCraft }) {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordIndex((current) => (current + 1) % ROTATING_WORDS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const activeWord = ROTATING_WORDS[wordIndex];

  return (
    <div className="hero-left">
      <h1 className="hero-title hero-title-interactive">
        <span className="hero-title-em">The </span>
        <span key={activeWord} className="hero-rotate-word">
          {activeWord}
        </span>
        <span className="hero-title-em"> that makes you say </span>
        <span className="hero-oh-mark">OH !</span>
      </h1>

      <p className="hero-subtitle">
        Layered oats, fruit & nuts — built fresh, bowl by bowl.
      </p>

      <div className="hero-ctas">
        <button type="button" className="btn-primary" onClick={onCustomizeBowl}>
          Customize Your Bowl <ArrowRight size={14} />
        </button>
        <button
          type="button"
          className="btn-secondary hero-btn-secondary"
          onClick={onDiscoverCraft}
        >
          Our Story
        </button>
      </div>
    </div>
  );
}
