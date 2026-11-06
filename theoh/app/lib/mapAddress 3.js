export function parseCoordsFromAddress(address) {
  if (!address) return null;

  const mapLink = address.includes(" || Map: ") ? address.split(" || Map: ")[1] : address;
  const match = mapLink.match(/query=([^&]+)/);
  if (!match) return null;

  const parts = decodeURIComponent(match[1]).split(",");
  if (parts.length < 2) return null;

  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

export function formatAddressForDisplay(addr) {
  if (!addr) return "";
  if (addr.includes(" || Map: ")) {
    return addr.split(" || Map: ")[0];
  }
  return addr;
}
