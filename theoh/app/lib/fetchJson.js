function isHtmlResponse(text) {
  const trimmed = text.trimStart();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

export async function parseJsonResponse(res) {
  const text = await res.text();

  if (!text) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status}).`);
    }
    return null;
  }

  if (isHtmlResponse(text)) {
    throw new Error(
      `Server returned HTML instead of JSON (${res.status}). Run "npm run dev" from the theoh folder and confirm API routes are deployed.`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? `Invalid JSON response (${res.status}).`
        : `Request failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
}

export async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await parseJsonResponse(res);
  return { res, data };
}

/* ---- Structured Error Types ---- */

export class FetchNetworkError extends Error {
  constructor(message = "Network error — couldn't connect to the server.") {
    super(message);
    this.name = "FetchNetworkError";
  }
}

export class FetchTimeoutError extends Error {
  constructor(message = "The request took too long. Please try again.") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

export class FetchHttpError extends Error {
  constructor(status, message) {
    super(message || `Request failed (${status}).`);
    this.name = "FetchHttpError";
    this.status = status;
  }
}

/**
 * Classify a caught fetch error into a user-friendly variant string.
 * Returns: "network" | "timeout" | "api" | "generic"
 */
export function classifyFetchError(error) {
  if (error instanceof FetchNetworkError) return "network";
  if (error instanceof FetchTimeoutError) return "timeout";
  if (error instanceof FetchHttpError) return "api";
  if (error instanceof TypeError && error.message?.includes("fetch")) return "network";
  return "generic";
}

/**
 * fetchJsonWithTimeout — fetch with automatic timeout and structured error types.
 * @param {string} url
 * @param {object} options — fetch options
 * @param {number} timeoutMs — timeout in milliseconds (default 15s)
 */
export async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const data = await parseJsonResponse(res).catch(() => null);
      const message = data?.error || `Request failed (${res.status}).`;
      throw new FetchHttpError(res.status, message);
    }

    const data = await parseJsonResponse(res);
    return { res, data };
  } catch (error) {
    clearTimeout(timer);

    if (error instanceof FetchHttpError) throw error;
    if (error.name === "AbortError") throw new FetchTimeoutError();
    if (error instanceof TypeError) throw new FetchNetworkError();
    throw error;
  }
}
