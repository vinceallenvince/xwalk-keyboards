"use client";

import { useEffect, useRef } from "react";

import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";

export type HomeFeedStatus = "connecting" | "live" | "reconnecting" | "unavailable";

const streamUrl = `/api/hls/${DEFAULT_LIVE_CAMERA.cameraId}/playlist.m3u8`;

export function HomeVideoBackground({ onStatusChange }: { onStatusChange: (status: HomeFeedStatus) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hls: import("hls.js").default | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const retry = () => {
      if (cancelled || retryTimer) return;
      onStatusChange("reconnecting");
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void load();
      }, 2_500);
    };
    const load = async () => {
      hls?.destroy();
      hls = null;
      onStatusChange("connecting");
      try {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ backBufferLength: 20, enableWorker: true, lowLatencyMode: false, maxBufferLength: 12 });
          hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(retry));
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) retry();
            else onStatusChange("unavailable");
          });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          return;
        }
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;
          await video.play();
          return;
        }
        onStatusChange("unavailable");
      } catch {
        retry();
      }
    };
    const markLive = () => onStatusChange("live");
    video.addEventListener("playing", markLive);
    video.addEventListener("error", retry);
    void load();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("playing", markLive);
      video.removeEventListener("error", retry);
    };
  }, [onStatusChange]);

  return <video aria-hidden="true" className="home-video-background" ref={videoRef} autoPlay muted playsInline />;
}
