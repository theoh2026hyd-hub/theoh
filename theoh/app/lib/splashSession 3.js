import { BOOT_SESSION_KEY, hasCompletedAppBoot, markAppBootComplete } from "./appBoot";

/** In-memory guard — survives React remounts within the same document. */
let splashSuppressed = false;

function syncSplashSuppressedFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry?.type === "reload") {
      splashSuppressed = false;
      sessionStorage.removeItem(BOOT_SESSION_KEY);
      return;
    }
    if (hasCompletedAppBoot()) {
      splashSuppressed = true;
    }
  } catch {
    // Ignore — fall through to in-memory flag.
  }
}

if (typeof window !== "undefined") {
  syncSplashSuppressedFromStorage();
}

/** Call before any overlay back / open so splash never replays on remount. */
export function suppressSplashPermanently() {
  splashSuppressed = true;
  markAppBootComplete();
}

export function shouldRenderSplash() {
  if (typeof window === "undefined") return false;
  syncSplashSuppressedFromStorage();
  if (splashSuppressed) return false;

  try {
    const navEntry = performance.getEntriesByType("navigation")[0];
    if (navEntry?.type === "reload") {
      return true;
    }
  } catch {
    // Fall through.
  }

  return !hasCompletedAppBoot();
}
