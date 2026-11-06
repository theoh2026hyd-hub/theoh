export const BOOT_SESSION_KEY = "theoh_boot_complete";

let suppressLandingPopState = false;

export function hasCompletedAppBoot() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(BOOT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Splash on first visit and hard reload; skip on in-session back/forward. */
export function shouldPlayBootSplash() {
  if (typeof window === "undefined") return true;
  try {
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry?.type === "reload") {
      return true;
    }
  } catch {
    // Fall through to session flag.
  }
  return !hasCompletedAppBoot();
}

export function markAppBootComplete() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BOOT_SESSION_KEY, "1");
  } catch {
    // Ignore storage failures — splash may show again this session.
  }
}

export function markOverlayPopStateHandled() {
  suppressLandingPopState = true;
}

export function consumeOverlayPopStateSuppression() {
  if (!suppressLandingPopState) return false;
  suppressLandingPopState = false;
  return true;
}
