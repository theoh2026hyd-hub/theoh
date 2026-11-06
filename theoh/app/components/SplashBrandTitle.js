"use client";

import { useEffect, useRef, useState } from "react";

export const SPLASH_BRAND_PARTS = ["THE", "OH", "!"];

const TYPING_START_DELAY_MS = 0;
const TYPING_CHAR_MS = 85;
const TYPING_WORD_PAUSE_MS = 70;

export default function SplashBrandTitle({
  animate = false,
  onTypingComplete,
  className = "splash-brand-title",
}) {
  const [typedParts, setTypedParts] = useState(() =>
    animate ? SPLASH_BRAND_PARTS.map(() => "") : [...SPLASH_BRAND_PARTS]
  );
  const [typingComplete, setTypingComplete] = useState(!animate);
  const [latestKey, setLatestKey] = useState(null);
  const onTypingCompleteRef = useRef(onTypingComplete);

  useEffect(() => {
    onTypingCompleteRef.current = onTypingComplete;
  }, [onTypingComplete]);

  useEffect(() => {
    if (!animate) return;

    setTypedParts(SPLASH_BRAND_PARTS.map(() => ""));
    setTypingComplete(false);
    setLatestKey(null);

    const timers = [];
    let cancelled = false;
    let delay = TYPING_START_DELAY_MS;

    const schedule = (fn, ms) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };

    SPLASH_BRAND_PARTS.forEach((part, partIdx) => {
      for (let charIdx = 1; charIdx <= part.length; charIdx += 1) {
        const slice = part.slice(0, charIdx);
        const letterKey = `${partIdx}-${charIdx - 1}`;
        schedule(() => {
          setTypedParts((prev) => {
            const next = [...prev];
            next[partIdx] = slice;
            return next;
          });
          setLatestKey(letterKey);
        }, delay);
        delay += TYPING_CHAR_MS;
      }

      if (partIdx < SPLASH_BRAND_PARTS.length - 1) {
        delay += TYPING_WORD_PAUSE_MS;
      }
    });

    schedule(() => {
      setTypedParts([...SPLASH_BRAND_PARTS]);
      setTypingComplete(true);
      setLatestKey(null);
      onTypingCompleteRef.current?.();
    }, delay);

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [animate]);

  return (
    <h1 className={className} aria-label="THE OH !">
      {SPLASH_BRAND_PARTS.map((fullPart, partIdx) => {
        const visibleText = typedParts[partIdx] || "";
        if (!visibleText) return null;

        return (
          <span key={fullPart} className="splash-brand-part">
            {visibleText.split("").map((char, charIdx) => {
              const letterKey = `${partIdx}-${charIdx}`;
              const isLatest = !typingComplete && latestKey === letterKey;

              return (
                <span
                  key={letterKey}
                  className={isLatest ? "splash-letter splash-letter-latest" : "splash-letter"}
                >
                  {char}
                </span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}
