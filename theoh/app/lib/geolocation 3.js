/**
 * Browser geolocation + Nominatim reverse geocoding for map-pinned addresses.
 */

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0
};

function parseNominatimAddress(data, latitude, longitude, accuracy = null) {
  const addr = data.address || {};
  const houseNumber = addr.house_number || "";
  const street = addr.road || addr.street || "";
  const area = addr.suburb || addr.neighbourhood || addr.residential || addr.locality || addr.subdivision || "";
  const city = addr.city || addr.town || addr.village || addr.county || "";
  const state = addr.state || "";
  const pincode = addr.postcode || "";
  const country = addr.country || "";
  const landmark = addr.amenity || addr.shop || addr.tourism || addr.historic || addr.leisure || "";

  return {
    latitude,
    longitude,
    accuracy,
    formattedAddress: data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    mapLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    details: {
      houseNumber,
      street,
      area,
      landmark,
      city,
      state,
      pincode,
      country
    }
  };
}

export function encodeMapAddress(locationData) {
  return `${locationData.formattedAddress} || Map: ${locationData.mapLink}`;
}

const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "TheOH-Reserve/1.0"
};

/** Search places by name — returns up to 5 results in India. */
export async function searchPlaces(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "in");

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error("Place search failed. Try a different name.");

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((row) => ({
    latitude: parseFloat(row.lat),
    longitude: parseFloat(row.lon),
    label: row.display_name
  }));
}

/** Get device GPS coordinates (used to center the map on the user's area). */
export function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return reject(new Error("Geolocation is not supported by this browser."));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let errMsg = "Could not access your location.";
        if (error.code === error.PERMISSION_DENIED) {
          errMsg = "Location permission is required. Please allow access in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errMsg = "GPS position unavailable. Turn on location services and try again.";
        } else if (error.code === error.TIMEOUT) {
          errMsg = "GPS request timed out. Please try again.";
        }
        reject(new Error(errMsg));
      },
      GEO_OPTIONS
    );
  });
}

/** Reverse geocode coordinates from a map pin. */
export async function reverseGeocodeCoords(latitude, longitude) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status}).`);
  const data = await res.json();
  return parseNominatimAddress(data, latitude, longitude);
}

/**
 * @deprecated Use getCurrentPositionAsync + reverseGeocodeCoords + map pin instead.
 */
export async function getDetailedLocation(onProgress) {
  if (onProgress) onProgress("Requesting browser GPS permission...");
  const pos = await getCurrentPositionAsync();
  if (onProgress) onProgress("Performing reverse geocoding...");
  const data = await reverseGeocodeCoords(pos.latitude, pos.longitude);
  return { ...data, accuracy: pos.accuracy, timestamp: new Date().toISOString() };
}
