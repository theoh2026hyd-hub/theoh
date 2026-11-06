"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Navigation, Search } from "lucide-react";
import { loadLeaflet } from "../lib/leafletLoader";
import {
  getCurrentPositionAsync,
  reverseGeocodeCoords,
  encodeMapAddress,
  searchPlaces,
} from "../lib/geolocation";
import { KITCHEN_LAT, KITCHEN_LNG } from "../lib/delivery";
import { hasMapLinkInAddress } from "../lib/delivery";
import { formatAddressForDisplay, parseCoordsFromAddress } from "../lib/mapAddress";

export default function InlineDeliveryMap({
  value,
  onChange,
  interactive = true,
  autoStart = false,
  showSearch = true,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocodeTimerRef = useRef(null);

  const [mapActive, setMapActive] = useState(
    autoStart || Boolean(value && hasMapLinkInAddress(value))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [bootKey, setBootKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);

  const destroyMap = useCallback(() => {
    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = null;
    }
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
  }, []);

  const scheduleReverseGeocode = useCallback(
    (lat, lng) => {
      if (!interactive || !onChange) return;

      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(async () => {
        setGeocoding(true);
        try {
          const data = await reverseGeocodeCoords(lat, lng);
          onChange(encodeMapAddress(data));
        } catch {
          onChange(
            encodeMapAddress({
              latitude: lat,
              longitude: lng,
              formattedAddress: `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
              mapLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
              details: {},
            })
          );
        } finally {
          setGeocoding(false);
        }
      }, 350);
    },
    [interactive, onChange]
  );

  const movePin = useCallback(
    (lat, lng) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (mapRef.current && !mapRef.current.getBounds().contains([lat, lng])) {
        mapRef.current.panTo([lat, lng]);
      }
      scheduleReverseGeocode(lat, lng);
    },
    [scheduleReverseGeocode]
  );

  const bindMarkerEvents = useCallback(
    (marker, map) => {
      marker.off("dragend");
      map.off("click");

      if (!interactive) {
        marker.dragging?.disable();
        return;
      }

      marker.dragging?.enable();
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        scheduleReverseGeocode(pos.lat, pos.lng);
      });

      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        scheduleReverseGeocode(e.latlng.lat, e.latlng.lng);
      });
    },
    [interactive, scheduleReverseGeocode]
  );

  const initMap = useCallback(
    (L, lat, lng) => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: interactive }).addTo(map);
      bindMarkerEvents(marker, map);

      mapRef.current = map;
      markerRef.current = marker;

      setTimeout(() => map.invalidateSize(), 100);
    },
    [bindMarkerEvents, interactive]
  );

  useEffect(() => {
    if (autoStart || (value && hasMapLinkInAddress(value))) {
      setMapActive(true);
    }
  }, [autoStart, value]);

  useEffect(() => {
    if (!mapActive) {
      destroyMap();
      return undefined;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError("");
      setStatusText("Loading map…");

      try {
        const L = await loadLeaflet();
        const savedCoords = parseCoordsFromAddress(value);
        let lat = savedCoords?.lat ?? KITCHEN_LAT;
        let lng = savedCoords?.lng ?? KITCHEN_LNG;

        if (!savedCoords) {
          try {
            setStatusText("Getting your location…");
            const pos = await getCurrentPositionAsync();
            lat = pos.latitude;
            lng = pos.longitude;
          } catch (gpsErr) {
            setStatusText("Search for a place or allow location access.");
            setError(gpsErr.message);
          }
        }

        if (cancelled) return;

        setLoading(false);
        setStatusText("");

        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (cancelled) return;

        initMap(L, lat, lng);

        if (interactive && (!value || !hasMapLinkInAddress(value))) {
          scheduleReverseGeocode(lat, lng);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load map.");
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [mapActive, bootKey, destroyMap, initMap, interactive, scheduleReverseGeocode]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    bindMarkerEvents(markerRef.current, mapRef.current);
    if (interactive) {
      const pos = markerRef.current.getLatLng();
      scheduleReverseGeocode(pos.lat, pos.lng);
    }
  }, [interactive, bindMarkerEvents, scheduleReverseGeocode]);

  useEffect(() => {
    if (!interactive) {
      setSearchQuery("");
      setSearchResults([]);
      setSearchError("");
    }
  }, [interactive]);

  const handleLocationAccess = () => {
    setError("");
    setMapActive(true);
  };

  const handlePlaceSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const results = await searchPlaces(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No places found. Try a nearby area, landmark, or city name.");
      }
    } catch (err) {
      setSearchError(err.message || "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const goToPlace = (place) => {
    setSearchResults([]);
    setSearchError("");
    movePin(place.latitude, place.longitude);
    mapRef.current?.setView([place.latitude, place.longitude], 16);
  };

  const recenterOnMe = async () => {
    if (locating) return;
    setError("");
    setLocating(true);
    if (!mapRef.current) {
      setBootKey((k) => k + 1);
      setLocating(false);
      return;
    }
    try {
      const pos = await getCurrentPositionAsync();
      movePin(pos.latitude, pos.longitude);
      mapRef.current?.setView([pos.latitude, pos.longitude], 17);
    } catch (err) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  };

  if (!mapActive) {
    return (
      <div className="inline-delivery-map-placeholder dashboard-address-map dashboard-address-map-tall">
        <MapPin size={34} className="inline-delivery-map-placeholder-icon" aria-hidden="true" />
        <p className="inline-delivery-map-placeholder-title">Pin your delivery location</p>
        <p className="inline-delivery-map-placeholder-hint">
          Allow location access to load the map and place your pin.
        </p>
        <button type="button" className="use-current-location-btn" onClick={handleLocationAccess}>
          <Navigation size={14} /> Location Access
        </button>
      </div>
    );
  }

  return (
    <div className="inline-delivery-map-wrap">
      {showSearch && !loading && (
        <div className="inline-delivery-map-toolbar location-map-toolbar">
          <p className="inline-delivery-map-hint">
            Search for a place, then drag the pin to your exact delivery spot.
          </p>
          <div className="location-search-row">
            <input
              type="text"
              className="location-search-input"
              placeholder="Search place or area (e.g. Gachibowli, Banjara Hills)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePlaceSearch();
                }
              }}
            />
            <button
              type="button"
              className="location-search-btn"
              onClick={handlePlaceSearch}
              disabled={searching || !searchQuery.trim()}
            >
              <Search size={16} />
              {searching ? "…" : "Search"}
            </button>
          </div>

          {searchError && <p className="location-search-error">{searchError}</p>}

          {searchResults.length > 0 && (
            <ul className="location-search-results">
              {searchResults.map((place, idx) => (
                <li key={`${place.latitude}-${place.longitude}-${idx}`}>
                  <button type="button" onClick={() => goToPlace(place)}>
                    {place.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className={`use-current-location-btn${locating ? " is-locating" : ""}`}
            onClick={recenterOnMe}
            disabled={locating}
            aria-busy={locating}
          >
            <Navigation size={14} aria-hidden="true" />
            {locating ? "Locating you…" : "Use my current location"}
          </button>
        </div>
      )}

      {loading && (
        <div className="inline-delivery-map-loading dashboard-address-map dashboard-address-map-tall">
          <div className="spinner" />
          <p>{statusText || "Loading map…"}</p>
        </div>
      )}
      {error && !loading && <p className="inline-delivery-map-error">{error}</p>}
      <div
        ref={mapContainerRef}
        className={`inline-delivery-map-canvas dashboard-address-map dashboard-address-map-tall${loading ? " inline-delivery-map-canvas-hidden" : ""}`}
      />
      {value && hasMapLinkInAddress(value) && (
        <p className="inline-delivery-map-address">
          {geocoding ? "Updating address for pin…" : formatAddressForDisplay(value)}
        </p>
      )}
      {!loading && error && (
        <button type="button" className="inline-delivery-map-retry" onClick={() => setBootKey((k) => k + 1)}>
          Retry Map
        </button>
      )}
    </div>
  );
}
