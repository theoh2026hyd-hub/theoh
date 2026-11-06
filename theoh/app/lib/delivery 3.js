/** Kitchen hub coordinates (matches main location map embed) */
export const KITCHEN_LAT = 17.385373;
export const KITCHEN_LNG = 78.37296;

/** Same travel mode everywhere: fee calculation, embed map, and external link */
export const DELIVERY_ROUTE_TRAVEL_MODE = "two-wheeler";
export const DELIVERY_EMBED_MODE = "two_wheeler";

const ROUTING_TIMEOUT_MS = 20000;

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Base fee up to baseKm; each extra km adds extraKmPrice (defaults: 3 km → ₹100, +₹15/km) */
export function calculateDeliveryFee(distanceKm, pricing = {}) {
  const baseKm = pricing.baseKm ?? 3;
  const baseFee = pricing.baseFee ?? 100;
  const extraKmPrice = pricing.extraKmPrice ?? 15;

  if (distanceKm <= baseKm) return baseFee;
  const extraKm = Math.ceil(distanceKm - baseKm);
  return baseFee + extraKm * extraKmPrice;
}

/** Extract destination lat/lng ONLY from the Google Maps link in the address */
export function parseCoordsFromMapLink(address) {
  if (!address || !address.includes(" || Map: ")) return null;

  const mapUrl = address.split(" || Map: ")[1]?.split(" || ")[0]?.trim();
  if (!mapUrl) return null;

  const dec = String.raw`-?\d+(?:\.\d+)?`;

  let match = mapUrl.match(new RegExp(`[?&]query=(${dec})[,%2C\\s]+(${dec})`, "i"));
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  match = mapUrl.match(new RegExp(`[?&]q=(${dec})[,%2C\\s]+(${dec})`, "i"));
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  match = mapUrl.match(new RegExp(`@(${dec})\\s*,\\s*(${dec})`));
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  match = mapUrl.match(new RegExp(`!3d(${dec})!4d(${dec})`));
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  return null;
}

/** @deprecated Use parseCoordsFromMapLink — kept for display helpers only */
export function parseCoordsFromDeliveryAddress(address) {
  return parseCoordsFromMapLink(address);
}

export function isTakeawayAddress(address) {
  if (!address) return false;
  const lower = address.toLowerCase();
  return lower.startsWith("takeaway") || lower.includes("pickup:");
}

export function hasMapLinkInAddress(address) {
  return Boolean(address && address.includes(" || Map: ") && parseCoordsFromMapLink(address));
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS) });
}

function pickShortestDistanceKm(distancesKm = []) {
  const valid = distancesKm.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

/**
 * Google Routes API — returns shortest distance among default, alternative,
 * and shorter-distance reference routes for the given travel mode.
 */
async function getGoogleRouteDistanceKm(fromLat, fromLng, toLat, toLng, travelMode = "TWO_WHEELER") {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const requestConfigs = [
    {
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: true,
      requestedReferenceRoutes: ["SHORTER_DISTANCE"]
    },
    {
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: true
    },
    {
      routingPreference: "TRAFFIC_UNAWARE",
      requestedReferenceRoutes: ["SHORTER_DISTANCE"]
    },
    {
      routingPreference: "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false
    }
  ];

  for (const config of requestConfigs) {
    try {
      const body = {
        origin: {
          location: { latLng: { latitude: fromLat, longitude: fromLng } }
        },
        destination: {
          location: { latLng: { latitude: toLat, longitude: toLng } }
        },
        travelMode,
        ...config
      };

      if (!body.requestedReferenceRoutes) {
        delete body.requestedReferenceRoutes;
      }

      const res = await fetchWithTimeout("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "routes.distanceMeters"
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const distancesKm = (data.routes || [])
        .map((route) => route.distanceMeters)
        .filter((meters) => meters != null)
        .map((meters) => meters / 1000);

      const shortest = pickShortestDistanceKm(distancesKm);
      if (shortest != null) return shortest;
    } catch {
      // Try next routing configuration.
    }
  }

  return null;
}

/** Google Routes API — two-wheeler (shortest of all map route options) */
async function getGoogleTwoWheelerDistanceKm(fromLat, fromLng, toLat, toLng) {
  return getGoogleRouteDistanceKm(fromLat, fromLng, toLat, toLng, "TWO_WHEELER");
}

/** Google Routes API — bicycle fallback when two-wheeler unavailable */
async function getGoogleBicycleDistanceKm(fromLat, fromLng, toLat, toLng) {
  const routesDistance = await getGoogleRouteDistanceKm(fromLat, fromLng, toLat, toLng, "BICYCLE");
  if (routesDistance != null) return routesDistance;

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${fromLat},${fromLng}`);
    url.searchParams.set("destinations", `${toLat},${toLng}`);
    url.searchParams.set("mode", "bicycling");
    url.searchParams.set("key", key);

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const element = data.rows?.[0]?.elements?.[0];
    if (element?.status !== "OK" || element.distance?.value == null) return null;

    return element.distance.value / 1000;
  } catch {
    return null;
  }
}

async function getOsrmBikeDistanceKm(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `https://router.project-osrm.org/route/v1/bike/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "TheOH-Reserve/1.0" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.distance) return null;
    return data.routes[0].distance / 1000;
  } catch {
    return null;
  }
}

async function getValhallaBikeDistanceKm(fromLat, fromLng, toLat, toLng) {
  try {
    const res = await fetchWithTimeout("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [
          { lat: fromLat, lon: fromLng },
          { lat: toLat, lon: toLng }
        ],
        costing: "bicycle",
        units: "kilometers"
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || data.trip?.summary?.length == null) return null;
    return data.trip.summary.length;
  } catch {
    return null;
  }
}

/**
 * Shortest bike route distance from kitchen to destination.
 * Uses the minimum distance returned by Google Maps routes (default + alternatives
 * + shorter-distance option), then falls back to other bike routing providers.
 */
export async function getBikeDistanceKm(fromLat, fromLng, toLat, toLng) {
  const googleTwoWheeler = await getGoogleTwoWheelerDistanceKm(fromLat, fromLng, toLat, toLng);
  if (googleTwoWheeler != null) return googleTwoWheeler;

  const googleBicycle = await getGoogleBicycleDistanceKm(fromLat, fromLng, toLat, toLng);
  if (googleBicycle != null) return googleBicycle;

  const [osrmResult, valhallaResult] = await Promise.allSettled([
    getOsrmBikeDistanceKm(fromLat, fromLng, toLat, toLng),
    getValhallaBikeDistanceKm(fromLat, fromLng, toLat, toLng)
  ]);

  const candidates = [];
  if (osrmResult.status === "fulfilled" && osrmResult.value != null) {
    candidates.push(osrmResult.value);
  }
  if (valhallaResult.status === "fulfilled" && valhallaResult.value != null) {
    candidates.push(valhallaResult.value);
  }

  return pickShortestDistanceKm(candidates);
}

export async function getDeliveryFeeFromCoordsAsync(lat, lng, pricing = {}) {
  const distanceKm = await getBikeDistanceKm(KITCHEN_LAT, KITCHEN_LNG, lat, lng);
  const baseFee = pricing.baseFee ?? 100;
  const routeUrls = buildDeliveryRouteUrls(lat, lng, distanceKm);

  if (distanceKm == null) {
    return {
      distanceKm: null,
      deliveryFee: baseFee,
      distanceMethod: "unknown",
      ...routeUrls
    };
  }

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    deliveryFee: calculateDeliveryFee(distanceKm, pricing),
    distanceMethod: "bike",
    ...routeUrls
  };
}

/** Resolve destination ONLY from the Google Maps link embedded in the address */
export async function resolveDeliveryCoords(address) {
  const parsed = parseCoordsFromMapLink(address);
  if (parsed) {
    return { ...parsed, source: "map_link" };
  }
  return null;
}

export async function geocodeAddressText(addressText) {
  const clean = addressText.split(" || Map:")[0].trim();
  if (!clean) return null;

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1`,
    { headers: { "User-Agent": "TheOH-Reserve/1.0" } }
  );

  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon)
  };
}

/** Zoom level so both kitchen and customer fit on mobile embed maps */
function getRouteEmbedZoom(distanceKm) {
  if (distanceKm <= 1.5) return 14;
  if (distanceKm <= 4) return 13;
  if (distanceKm <= 8) return 12;
  if (distanceKm <= 15) return 11;
  if (distanceKm <= 25) return 10;
  return 9;
}

function getGoogleMapsEmbedKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

export function buildDeliveryRouteEndpoints(destLat, destLng) {
  return {
    origin: `${KITCHEN_LAT},${KITCHEN_LNG}`,
    destination: `${destLat},${destLng}`
  };
}

/** External Google Maps directions link — always two-wheeler mode */
export function buildDeliveryRouteMapLink(destLat, destLng) {
  const { origin, destination } = buildDeliveryRouteEndpoints(destLat, destLng);
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: DELIVERY_ROUTE_TRAVEL_MODE
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Embedded directions map — kitchen → customer, same two-wheeler mode as delivery fee */
export function buildDeliveryRouteMapEmbedUrl(destLat, destLng, distanceKm = null) {
  const { origin, destination } = buildDeliveryRouteEndpoints(destLat, destLng);
  const embedKey = getGoogleMapsEmbedKey();

  if (embedKey) {
    const params = new URLSearchParams({
      key: embedKey,
      origin,
      destination,
      mode: DELIVERY_EMBED_MODE
    });
    return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
  }

  const zoom = getRouteEmbedZoom(
    distanceKm ?? haversineDistanceKm(KITCHEN_LAT, KITCHEN_LNG, destLat, destLng)
  );
  const centerLat = (KITCHEN_LAT + destLat) / 2;
  const centerLng = (KITCHEN_LNG + destLng) / 2;
  const params = new URLSearchParams({
    saddr: origin,
    daddr: destination,
    dirflg: "b",
    hl: "en",
    ll: `${centerLat},${centerLng}`,
    z: String(zoom),
    output: "embed"
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

export function buildDeliveryRouteUrls(destLat, destLng, distanceKm = null) {
  return {
    routeMapLink: buildDeliveryRouteMapLink(destLat, destLng),
    routeEmbedUrl: buildDeliveryRouteMapEmbedUrl(destLat, destLng, distanceKm)
  };
}

/** Google Maps embed showing route from kitchen to customer map-link point */
export function getDeliveryRouteMapEmbedUrl(address) {
  const dest = parseCoordsFromMapLink(address);
  if (!dest) return null;
  return buildDeliveryRouteMapEmbedUrl(dest.lat, dest.lng);
}

export function getDeliveryRouteMapLink(address) {
  const dest = parseCoordsFromMapLink(address);
  if (!dest) return null;
  return buildDeliveryRouteMapLink(dest.lat, dest.lng);
}
