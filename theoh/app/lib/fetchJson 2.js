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
