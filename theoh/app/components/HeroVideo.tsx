"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { optimizeCloudinaryVideoUrl } from "../lib/heroMedia";

export type HeroVideoProps = {
  videoUrl: string;
  /** Shown only if the video fails to load. */
  fallbackPoster?: string;
  onReady?: () => void;
  onFailed?: () => void;
  className?: string;
  /** When false, skip attaching listeners (e.g. dashboard overlay is open). */
  active?: boolean;
};

/** Persists hero video state across dashboard/checkout unmounts in the same page load. */
const memoryCache = {
  url: "",
  visible: false,
  failed: false,
};

function tryPlayVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  video.muted = true;
  const playPromise = video.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {
      /* Autoplay blocked — splash stays until playback starts. */
    });
  }
}

function useStableCallback<T extends (...args: never[]) => void>(
  callback: T | undefined
): RefObject<T | undefined> {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);
  return ref;
}

function HeroVideoComponent({
  videoUrl,
  fallbackPoster,
  onReady,
  onFailed,
  className = "",
  active = true,
}: HeroVideoProps) {
  const optimizedUrl = optimizeCloudinaryVideoUrl(videoUrl);

  const videoRef = useRef<HTMLVideoElement>(null);
  const readyNotified = useRef(false);
  const failedNotified = useRef(false);
  const onReadyRef = useStableCallback(onReady);
  const onFailedRef = useStableCallback(onFailed);

  const [videoVisible, setVideoVisible] = useState(
    () =>
      memoryCache.url === optimizedUrl &&
      memoryCache.visible &&
      !memoryCache.failed
  );
  const [failed, setFailed] = useState(
    () => memoryCache.url === optimizedUrl && memoryCache.failed
  );

  const notifyReady = useCallback(() => {
    if (readyNotified.current) return;
    readyNotified.current = true;
    memoryCache.url = optimizedUrl;
    memoryCache.visible = true;
    memoryCache.failed = false;
    setVideoVisible(true);
    setFailed(false);
    onReadyRef.current?.();
  }, [optimizedUrl, onReadyRef]);

  const notifyFailed = useCallback(() => {
    if (failedNotified.current) return;
    failedNotified.current = true;
    memoryCache.url = optimizedUrl;
    memoryCache.visible = false;
    memoryCache.failed = true;
    setFailed(true);
    setVideoVisible(false);
    onFailedRef.current?.();
  }, [optimizedUrl, onFailedRef]);

  useEffect(() => {
    if (!optimizedUrl) {
      readyNotified.current = false;
      failedNotified.current = false;
      setFailed(false);
      setVideoVisible(false);
      return;
    }

    if (memoryCache.url !== optimizedUrl) {
      memoryCache.url = optimizedUrl;
      memoryCache.visible = false;
      memoryCache.failed = false;
      readyNotified.current = false;
      failedNotified.current = false;
      setVideoVisible(false);
      setFailed(false);
      return;
    }

    if (memoryCache.visible) {
      readyNotified.current = true;
      setVideoVisible(true);
      setFailed(false);
      onReadyRef.current?.();
    } else if (memoryCache.failed) {
      failedNotified.current = true;
      setFailed(true);
      setVideoVisible(false);
      onFailedRef.current?.();
    }
  }, [optimizedUrl, onReadyRef, onFailedRef]);

  useEffect(() => {
    if (!active || !optimizedUrl || failed) return undefined;

    if (readyNotified.current) return undefined;

    let cancelled = false;
    let removeListeners: (() => void) | null = null;

    const attach = () => {
      const video = videoRef.current;
      if (!video || cancelled) return;

      const handleCanPlay = () => {
        if (cancelled) return;
        notifyReady();
        tryPlayVideo(video);
      };

      const handleError = () => {
        if (cancelled) return;
        notifyFailed();
      };

      removeListeners?.();
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("error", handleError);

      removeListeners = () => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
      };

      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        handleCanPlay();
        return;
      }

      if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        video.load();
      }
    };

    const rafId = requestAnimationFrame(attach);
    const retryId = window.setTimeout(attach, 80);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(retryId);
      removeListeners?.();
    };
  }, [active, optimizedUrl, failed, notifyReady, notifyFailed]);

  useEffect(() => {
    if (!active || !videoVisible || failed) return undefined;

    const video = videoRef.current;
    const stage = video?.parentElement;
    if (!video || !stage) return undefined;

    const resume = () => tryPlayVideo(video);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) resume();
      },
      { threshold: 0.2 }
    );

    observer.observe(stage);
    resume();

    const onVisibility = () => {
      if (document.visibilityState === "visible") resume();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, videoVisible, failed]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-[#0a0b09] ${className}`.trim()}
      aria-hidden="true"
    >
      {failed && fallbackPoster ? (
        <div
          className="hero-media-fallback is-visible"
          style={{ backgroundImage: `url(${fallbackPoster})` }}
        />
      ) : null}

      {!failed && optimizedUrl ? (
        <video
          ref={videoRef}
          key={optimizedUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ease-out ${
            videoVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        >
          <source src={optimizedUrl} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}

export default memo(HeroVideoComponent);
