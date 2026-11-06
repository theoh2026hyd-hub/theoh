"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PRODUCT_IMAGE,
  getSafeLocalFallback,
  resolveBrandLogo,
  resolveProductImage,
} from "../lib/productImages";

export default function SafeImage({
  src,
  alt = "",
  category = "",
  name = "",
  fallback = null,
  hideOnError = false,
  className = "",
  ...props
}) {
  const resolvedFallback = useMemo(
    () => fallback || getSafeLocalFallback(category, name),
    [fallback, category, name]
  );

  const resolvedSrc = useMemo(() => {
    if (!src) return resolvedFallback;
    if (category || name) {
      return resolveProductImage(src, category, name);
    }
    return resolveBrandLogo(src);
  }, [src, category, name, resolvedFallback]);

  const [imgSrc, setImgSrc] = useState(resolvedSrc);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setImgSrc(resolvedSrc);
    setHidden(false);
  }, [resolvedSrc]);

  if (hideOnError && hidden) {
    return null;
  }

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => {
        // Remote/storage URL failed → try category fallback, then guaranteed local default.
        if (imgSrc !== resolvedFallback && resolvedFallback) {
          setImgSrc(resolvedFallback);
          return;
        }
        if (imgSrc !== DEFAULT_PRODUCT_IMAGE) {
          setImgSrc(DEFAULT_PRODUCT_IMAGE);
          return;
        }
        if (hideOnError) {
          setHidden(true);
        }
      }}
    />
  );
}
