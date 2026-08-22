"use client";

import { useEffect, useRef, useState } from "react";

type FeedStatus = "connecting" | "live" | "reconnecting" | "unavailable";

export function RegistryLivePreview({ cameraId }: { cameraId: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<FeedStatus>("connecting");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = `/api/hls/${cameraId}/playlist.m3u8`;

    let cancelled = false;
    let hls: import("hls.js").default | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const retry = () => {
      if (cancelled || retryTimer) return;
      setStatus("reconnecting");
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void load();
      }, 2_500);
    };

    const load = async () => {
      hls?.destroy();
      hls = null;
      setStatus("connecting");
      try {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ backBufferLength: 20, enableWorker: true, lowLatencyMode: false, maxBufferLength: 12 });
          hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(retry));
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) retry();
            else setStatus("unavailable");
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
        setStatus("unavailable");
      } catch {
        retry();
      }
    };

    const markLive = () => setStatus("live");
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
  }, [cameraId]);

  const statusLabel =
    status === "live" ? "LIVE"
    : status === "connecting" ? "CONNECTING…"
    : status === "reconnecting" ? "RECONNECTING…"
    : "UNAVAILABLE";

  return (
    <div className="live-preview">
      <video ref={videoRef} className="live-preview__video" autoPlay muted playsInline />
      <div className="live-preview__overlay">
        <span>VIEW {cameraId}</span>
        <small className={status === "live" ? "live-preview__status--live" : undefined}>{statusLabel}</small>
      </div>
    </div>
  );
}
