"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, MapPin, Check, ShieldAlert, Navigation, Search } from "lucide-react";
import {
  getCurrentPositionAsync,
  reverseGeocodeCoords,
  encodeMapAddress,
  searchPlaces
} from "../lib/geolocation";
import { KITCHEN_LAT, KITCHEN_LNG } from "../lib/delivery";

import { loadLeaflet } from "../lib/leafletLoader";

export default function LocationVerifierModal({ isOpen, onClose, onConfirm }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocodeTimerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("Loading map…");
  const [bootError, setBootError] = useState("");
  const [gpsWarning, setGpsWarning] = useState("");
  const [locationData, setLocationData] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [bootKey, setBootKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");

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
    setMapReady(false);
  }, []);

  const scheduleReverseGeocode = useCallback((lat, lng) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      setGeocoding(true);
      try {
        const data = await reverseGeocodeCoords(lat, lng);
        setLocationData(data);
      } catch {
        setLocationData({
          latitude: lat,
          longitude: lng,
          formattedAddress: `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
          mapLink: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          details: {}
        });
      } finally {
        setGeocoding(false);
      }
    }, 350);
  }, []);

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

  const initMap = useCallback(
    (L, lat, lng) => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        scheduleReverseGeocode(pos.lat, pos.lng);
      });

      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        scheduleReverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);

      setTimeout(() => map.invalidateSize(), 100);
    },
    [scheduleReverseGeocode]
  );

  useEffect(() => {
    if (!isOpen) {
      destroyMap();
      setLocationData(null);
      setBootError("");
      setGpsWarning("");
      setSearchQuery("");
      setSearchResults([]);
      setSearchError("");
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setBootError("");
      setGpsWarning("");
      setSearchQuery("");
      setSearchResults([]);
      setSearchError("");
      setStatusText("Loading map…");

      try {
        const L = await loadLeaflet();
        let lat = KITCHEN_LAT;
        let lng = KITCHEN_LNG;

        try {
          setStatusText("Getting your location…");
          const pos = await getCurrentPositionAsync();
          lat = pos.latitude;
          lng = pos.longitude;
        } catch (gpsErr) {
          setGpsWarning(
            `${gpsErr.message} Search for a place below, then drag the pin to your exact delivery spot.`
          );
        }

        if (cancelled) return;

        setStatusText("Search for an area or drag the pin to your exact delivery point.");
        setLoading(false);

        await new Promise((r) => requestAnimationFrame(r));
        if (cancelled) return;

        initMap(L, lat, lng);
        scheduleReverseGeocode(lat, lng);
      } catch (err) {
        if (!cancelled) {
          setBootError(err.message);
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [isOpen, bootKey, destroyMap, initMap, scheduleReverseGeocode]);

  const retryBootstrap = () => setBootKey((k) => k + 1);

  const recenterOnMe = async () => {
    setGpsWarning("");
    if (!mapRef.current) {
      retryBootstrap();
      return;
    }
    try {
      const pos = await getCurrentPositionAsync();
      movePin(pos.latitude, pos.longitude);
      mapRef.current?.setView([pos.latitude, pos.longitude], 17);
    } catch (err) {
      setGpsWarning(err.message);
    }
  };

  const handlePlaceSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const results = await searchPlaces(q);
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

  if (!isOpen) return null;

  return (
    <div className="location-modal-overlay" onClick={onClose}>
      <div className="location-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="location-modal-header">
          <h3>
            <MapPin size={20} /> Pin Your Delivery Location
          </h3>
          <button type="button" onClick={onClose} className="location-modal-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <p className="location-modal-hint">
          Search for a place (e.g. office, friend&apos;s area) or use GPS for your current area. Tap the map or drag the pin to mark the exact delivery spot.
        </p>

        {loading && (
          <div className="location-modal-loading">
            <div className="spinner" />
            <p>{statusText}</p>
          </div>
        )}

        {bootError && !loading && (
          <div className="location-modal-error">
            <ShieldAlert size={32} />
            <p>{bootError}</p>
            <button type="button" className="btn-secondary" onClick={retryBootstrap}>
              Retry
            </button>
          </div>
        )}

        {!loading && !bootError && (
          <>
            {gpsWarning && (
              <div className="location-gps-warning">
                <ShieldAlert size={16} />
                <span>{gpsWarning}</span>
              </div>
            )}

            <div className="location-map-toolbar">
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

              <button type="button" className="use-current-location-btn" onClick={recenterOnMe}>
                <Navigation size={14} /> Re-center on my GPS
              </button>
            </div>

            <div ref={mapContainerRef} className="location-map-container" />

            {mapReady && locationData && (
              <div className="location-pin-details">
                <div className="location-coords-row">
                  <span><strong>Lat:</strong> {locationData.latitude.toFixed(6)}</span>
                  <span><strong>Lng:</strong> {locationData.longitude.toFixed(6)}</span>
                </div>
                <p className="location-address-preview">
                  {geocoding ? "Updating address for pin…" : locationData.formattedAddress}
                </p>
                <a
                  href={locationData.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="location-map-link-preview"
                >
                  Preview in Google Maps
                </a>
              </div>
            )}

            <div className="location-modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary location-confirm-btn"
                disabled={!locationData || geocoding}
                onClick={() => {
                  if (!locationData) return;
                  onConfirm(encodeMapAddress(locationData));
                  onClose();
                }}
              >
                <Check size={16} /> Confirm This Location
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
