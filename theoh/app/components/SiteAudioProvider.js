"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getHeroAudioUrl } from "../lib/heroMedia";
import { parseJsonResponse } from "../lib/fetchJson";

/** User mute via navbar only. Default unmuted so music autoplays. */
const MUTE_STORAGE_KEY = "theoh_hero_audio_muted_v5";
const AUDIO_URL_CACHE_KEY = "theoh_hero_audio_url_v1";

const SiteAudioContext = createContext({
  audioUrl: "",
  hasAudio: false,
  muted: true,
  isPlaying: false,
  toggleMute: () => {},
  setMuted: () => {},
  bootstrapped: false,
});

export function useSiteAudio() {
  return useContext(SiteAudioContext);
}

function readStoredMuted() {
  try {
    const raw = localStorage.getItem(MUTE_STORAGE_KEY);
    if (raw == null) return false;
    return raw === "1";
  } catch (_) {
    return false;
  }
}

function writeStoredMuted(muted) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch (_) {}
}

function readCachedAudioUrl() {
  try {
    return String(localStorage.getItem(AUDIO_URL_CACHE_KEY) || "").trim();
  } catch (_) {
    return "";
  }
}

function writeCachedAudioUrl(url) {
  try {
    if (url) localStorage.setItem(AUDIO_URL_CACHE_KEY, url);
  } catch (_) {}
}

function isAdminPath(pathname) {
  return typeof pathname === "string" && (pathname === "/admin" || pathname.startsWith("/admin/"));
}

export default function SiteAudioProvider({ children }) {
  const pathname = usePathname();
  const adminRoute = isAdminPath(pathname);

  const audioRef = useRef(null);
  const wantSoundRef = useRef(true);
  const tabAwayRef = useRef(false);
  const adminRouteRef = useRef(adminRoute);
  const audioUrlRef = useRef("");
  const playInFlightRef = useRef(null);

  const [audioUrl, setAudioUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [userMuted, setUserMuted] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    adminRouteRef.current = adminRoute;
  }, [adminRoute]);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    const muted = readStoredMuted();
    wantSoundRef.current = !muted;
    setUserMuted(muted);
    const cached = readCachedAudioUrl();
    if (cached) setAudioUrl(cached);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/menu", { cache: "no-store" })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (cancelled || !data?.success) return;
        const url = getHeroAudioUrl(data.settings || {});
        if (!url) return;
        writeCachedAudioUrl(url);
        setAudioUrl((prev) => (prev === url ? prev : url));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const prepareElement = useCallback((audio, url) => {
    if (!audio || !url) return;
    audio.loop = true;
    audio.preload = "auto";
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    if (audio.getAttribute("src") !== url) {
      audio.src = url;
    }
  }, []);

  const hardStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(false);
      return;
    }
    try {
      audio.pause();
    } catch (_) {}
    audio.muted = true;
    setIsPlaying(false);
  }, []);

  const playAudible = useCallback(async () => {
    if (tabAwayRef.current || !wantSoundRef.current || adminRouteRef.current) {
      return false;
    }

    if (playInFlightRef.current) {
      try {
        return await playInFlightRef.current;
      } catch (_) {
        return false;
      }
    }

    const run = (async () => {
      if (tabAwayRef.current || !wantSoundRef.current || adminRouteRef.current) {
        return false;
      }

      const audio = audioRef.current;
      const url = audioUrlRef.current;
      if (!audio || !url) return false;

      prepareElement(audio, url);
      audio.volume = 0.55;
      audio.muted = false;

      try {
        const maybe = audio.play();
        if (maybe && typeof maybe.then === "function") await maybe;
        if (tabAwayRef.current || !wantSoundRef.current) {
          hardStop();
          return false;
        }
        setIsPlaying(true);
        setUserMuted(false);
        setAutoplayBlocked(false);
        return true;
      } catch (err) {
        setIsPlaying(false);
        if (err && (err.name === 'NotAllowedError' || String(err.message).includes('play()'))) {
          setAutoplayBlocked(true);
        }
        return false;
      }
    })();

    playInFlightRef.current = run;
    try {
      return await run;
    } finally {
      if (playInFlightRef.current === run) playInFlightRef.current = null;
    }
  }, [prepareElement, hardStop]);

  // Autoplay when track is ready; silent gesture unlock if browser blocks unmuted play.
  useEffect(() => {
    if (!audioUrl || adminRoute) {
      hardStop();
      return undefined;
    }

    const audio = audioRef.current;
    if (!audio) return undefined;

    prepareElement(audio, audioUrl);

    const onPlaying = () => {
      if (!tabAwayRef.current && wantSoundRef.current && audio && !audio.muted) {
        setIsPlaying(true);
      }
    };
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);

    if (wantSoundRef.current && !tabAwayRef.current) {
      void playAudible();
    } else {
      hardStop();
    }

    const unlockEvents = ["pointerdown", "touchstart", "keydown", "click", "scroll"];
    const tryUnlock = () => {
      if (!wantSoundRef.current || tabAwayRef.current || adminRouteRef.current) return;
      void playAudible().then((ok) => {
        if (ok) {
          setAutoplayBlocked(false);
          unlockEvents.forEach((evt) => {
            window.removeEventListener(evt, tryUnlock, true);
          });
        }
      });
    };
    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, tryUnlock, { capture: true, passive: true });
    });

    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      unlockEvents.forEach((evt) => {
        window.removeEventListener(evt, tryUnlock, true);
      });
    };
  }, [audioUrl, adminRoute, prepareElement, playAudible, hardStop]);

  useEffect(() => {
    if (!adminRoute) return undefined;
    hardStop();
    return undefined;
  }, [adminRoute, hardStop]);

  // Stop immediately when user leaves this tab (switch / swipe away / app background).
  useEffect(() => {
    const leaveTab = () => {
      tabAwayRef.current = true;
      hardStop();
    };

    const returnTab = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        leaveTab();
        return;
      }
      tabAwayRef.current = false;
      if (wantSoundRef.current && !adminRouteRef.current) {
        void playAudible();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") leaveTab();
      else returnTab();
    };

    const onPageHide = () => leaveTab();
    const onPageShow = () => returnTab();
    const onFreeze = () => leaveTab();
    const onResume = () => returnTab();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("freeze", onFreeze);
    document.addEventListener("resume", onResume);

    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      leaveTab();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("freeze", onFreeze);
      document.removeEventListener("resume", onResume);
    };
  }, [hardStop, playAudible]);

  const setMuted = useCallback(
    async (nextMuted) => {
      const audio = audioRef.current;
      if (!audio || !audioUrlRef.current || adminRouteRef.current) return false;

      if (!nextMuted) {
        wantSoundRef.current = true;
        writeStoredMuted(false);
        setUserMuted(false);
        if (tabAwayRef.current) return true;
        return playAudible();
      }

      wantSoundRef.current = false;
      writeStoredMuted(true);
      setUserMuted(true);
      hardStop();
      return true;
    },
    [playAudible, hardStop]
  );

  const toggleMute = useCallback(async () => {
    if (!audioRef.current || !audioUrlRef.current || adminRouteRef.current) return;
    await setMuted(wantSoundRef.current);
  }, [setMuted]);

  const hasAudio = Boolean(audioUrl) && !adminRoute;

  return (
    <SiteAudioContext.Provider
      value={{
        audioUrl: adminRoute ? "" : audioUrl,
        hasAudio,
        muted: adminRoute ? true : (userMuted || autoplayBlocked),
        isPlaying: adminRoute ? false : isPlaying,
        toggleMute,
        setMuted,
        bootstrapped,
      }}
    >
      {children}
      {autoplayBlocked && (
        <div className="audio-permission-popup" style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
          padding: "16px 20px",
          borderRadius: "12px",
          background: "#ffffff",
          color: "#000000",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          border: "1px solid #E8E5DF"
        }}>
          <p className="audio-permission-title" style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#000000", WebkitTextFillColor: "#000000" }}>
            Allow background music?
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              className="btn-primary" 
              style={{ padding: "6px 14px", minWidth: "0", minHeight: "0", fontSize: "13px" }}
              onClick={() => {
                setAutoplayBlocked(false);
                playAudible();
              }}
            >
              Allow
            </button>
            <button 
              className="btn-secondary" 
              style={{ padding: "6px 14px", minWidth: "0", minHeight: "0", fontSize: "13px" }}
              onClick={() => {
                setAutoplayBlocked(false);
                setMuted(true);
              }}
            >
              Mute
            </button>
          </div>
        </div>
      )}
      <audio
        ref={audioRef}
        className="site-background-audio"
        preload="auto"
        playsInline
        // eslint-disable-next-line react/no-unknown-property
        webkit-playsinline=""
      />
    </SiteAudioContext.Provider>
  );
}
