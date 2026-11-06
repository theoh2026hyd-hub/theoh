export const LANDING_NAV_OFFSET = 80;
export const LANDING_SECTION_HISTORY_KEY = "landingSection";

export function normalizeLandingSectionId(sectionId) {
  if (!sectionId || sectionId === "home") return "home";
  return sectionId;
}

export function getLandingSectionFromLocation(locationLike) {
  if (typeof window === "undefined" && !locationLike) return "home";
  const source =
    locationLike ||
    (typeof window !== "undefined"
      ? { pathname: window.location.pathname, search: window.location.search }
      : null);
  if (!source) return "home";

  const params = new URLSearchParams(source.search || "");
  return normalizeLandingSectionId(params.get("section"));
}

export function buildLandingSectionPath(sectionId) {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  const normalized = normalizeLandingSectionId(sectionId);
  if (normalized === "home") {
    url.searchParams.delete("section");
  } else {
    url.searchParams.set("section", normalized);
  }
  return `${url.pathname}${url.search}`;
}

export function pushLandingSectionHistory(sectionId) {
  if (typeof window === "undefined") return;
  const normalized = normalizeLandingSectionId(sectionId);
  window.history.pushState(
    { ...window.history.state, [LANDING_SECTION_HISTORY_KEY]: normalized },
    "",
    buildLandingSectionPath(normalized)
  );
}

export function replaceLandingSectionHistory(sectionId) {
  if (typeof window === "undefined") return;
  const normalized = normalizeLandingSectionId(sectionId);
  window.history.replaceState(
    { ...window.history.state, [LANDING_SECTION_HISTORY_KEY]: normalized },
    "",
    buildLandingSectionPath(normalized)
  );
}

export function readLandingSectionFromHistoryEvent(event) {
  const fromState = event?.state?.[LANDING_SECTION_HISTORY_KEY];
  if (fromState) return normalizeLandingSectionId(fromState);
  return getLandingSectionFromLocation();
}

export function getSectionScrollTop(sectionId) {
  if (typeof window === "undefined") return null;
  const element = document.getElementById(sectionId);
  if (!element) return null;
  return Math.max(0, element.getBoundingClientRect().top + window.scrollY - LANDING_NAV_OFFSET);
}

export function scrollToLandingSection(sectionId, { behavior = "smooth" } = {}) {
  const top = getSectionScrollTop(sectionId);
  if (top == null) return false;
  window.scrollTo({ top, behavior });
  return true;
}

/** Keeps correcting scroll position while layout above the target section is still loading. */
export function scrollToLandingSectionWithRetry(
  sectionId,
  {
    behavior = "smooth",
    maxAttempts = 25,
    intervalMs = 120,
    onComplete,
    enableRetry = true
  } = {}
) {
  let attempt = 0;
  let cancelled = false;
  let timerId = null;
  const totalAttempts = enableRetry ? maxAttempts : 1;

  const cleanup = () => {
    cancelled = true;
    if (timerId) clearTimeout(timerId);
  };

  const finish = () => {
    if (onComplete) onComplete();
  };

  const tryScroll = () => {
    if (cancelled) return;

    const targetTop = getSectionScrollTop(sectionId);
    if (targetTop == null) {
      finish();
      return;
    }

    const drift = Math.abs(window.scrollY - targetTop);
    const settled = drift < 6;

    if (!settled) {
      const useSmooth = attempt === 0 ? behavior : "auto";
      scrollToLandingSection(sectionId, { behavior: useSmooth });
    }

    attempt += 1;

    if (settled || attempt >= totalAttempts) {
      finish();
      return;
    }

    timerId = setTimeout(tryScroll, intervalMs);
  };

  tryScroll();
  return cleanup;
}
