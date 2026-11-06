"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

/**
 * NetworkStatusProvider — Detects online/offline state and shows a non-intrusive banner.
 * Uses navigator.onLine and online/offline events.
 * Wraps children and provides network status via context.
 */

const NetworkContext = createContext({ isOnline: true });

export function useNetworkStatus() {
  return useContext(NetworkContext);
}

export default function NetworkStatusProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
      if (!navigator.onLine) {
        setShowBanner(true);
      }
    }

    const goOnline = () => {
      setIsOnline(true);
      // Show "back online" briefly then hide
      if (wasOffline) {
        setShowBanner(true);
        const timer = setTimeout(() => setShowBanner(false), 3000);
        return () => clearTimeout(timer);
      }
    };

    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [wasOffline]);

  // Auto-hide the "back online" banner
  useEffect(() => {
    if (isOnline && showBanner) {
      const timer = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showBanner]);

  const handleRetry = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}

      {showBanner && (
        <div
          className={`network-banner ${isOnline ? "network-banner--online" : "network-banner--offline"}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="network-banner-content">
            {isOnline ? (
              <>
                <Wifi size={16} aria-hidden="true" />
                <span>You&apos;re back online</span>
              </>
            ) : (
              <>
                <WifiOff size={16} aria-hidden="true" />
                <span>No internet connection</span>
                <button
                  type="button"
                  className="network-banner-retry"
                  onClick={handleRetry}
                  aria-label="Retry connection"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Retry
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </NetworkContext.Provider>
  );
}
