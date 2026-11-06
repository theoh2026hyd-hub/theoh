export const PLACEHOLDER_ADDRESSES = new Set([
  "Flat 402, Green Meadows Apartments",
  "Sutton Place Hotel, Suite 1402"
]);

export function normalizeProfileAddress(addr) {
  if (!addr || typeof addr !== "string") return null;
  const trimmed = addr.trim();
  if (!trimmed || PLACEHOLDER_ADDRESSES.has(trimmed)) return null;
  return trimmed;
}

export function profileAddressLabel(addr) {
  return normalizeProfileAddress(addr) ? addr : "Not added";
}
