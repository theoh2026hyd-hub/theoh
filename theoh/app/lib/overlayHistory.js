import { useEffect, useRef } from "react";
import { markOverlayPopStateHandled } from "./appBoot";
import { suppressSplashPermanently } from "./splashSession";

export const OVERLAY_HISTORY_KEY = "theohOverlay";

let suppressOverlayPush = false;
let programmaticOverlayDismiss = false;

export function pushOverlayHistory(overlayId) {
  if (typeof window === "undefined" || suppressOverlayPush || !overlayId) return;
  suppressSplashPermanently();
  window.history.pushState(
    { ...window.history.state, [OVERLAY_HISTORY_KEY]: overlayId, ts: Date.now() },
    "",
    window.location.pathname + window.location.search
  );
}

export function suppressOverlayHistoryPush() {
  suppressOverlayPush = true;
  window.setTimeout(() => {
    suppressOverlayPush = false;
  }, 0);
}

export function backOverlayHistory() {
  if (typeof window === "undefined") return false;
  if (window.history.state?.[OVERLAY_HISTORY_KEY]) {
    markOverlayPopStateHandled();
    suppressOverlayHistoryPush();
    window.history.back();
    return true;
  }
  return false;
}

/** Sync history after programmatic close (X / outside click) without re-running overlay onBack. */
export function dismissOverlayHistory() {
  if (typeof window === "undefined") return;
  if (!window.history.state?.[OVERLAY_HISTORY_KEY]) return;
  markOverlayPopStateHandled();
  suppressOverlayHistoryPush();
  programmaticOverlayDismiss = true;
  window.history.back();
  programmaticOverlayDismiss = false;
}

export function useOverlayBack(isActive, overlayId, onBack) {
  const onBackRef = useRef(onBack);
  const lastPushedIdRef = useRef(null);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!isActive || !overlayId) {
      lastPushedIdRef.current = null;
      return;
    }

    if (lastPushedIdRef.current !== overlayId) {
      pushOverlayHistory(overlayId);
      lastPushedIdRef.current = overlayId;
    }

    const handlePopState = () => {
      if (programmaticOverlayDismiss) return;
      suppressSplashPermanently();
      markOverlayPopStateHandled();
      suppressOverlayHistoryPush();
      lastPushedIdRef.current = null;
      onBackRef.current?.();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  }, [isActive, overlayId]);
}
