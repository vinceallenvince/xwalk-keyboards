"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RealtimeInference, type InferenceStatus } from "@/components/realtime-inference";

type CameraStatus = "connecting" | "live" | "reconnecting" | "unavailable";

const streamUrl = "/api/hls/5056/playlist.m3u8";

const inferenceLabels: Record<InferenceStatus, string> = {
  waiting: "INFERENCE: WAITING FOR VIDEO",
  starting: "INFERENCE: CONNECTING",
  active: "INFERENCE: ACTIVE",
  reconnecting: "INFERENCE: RECONNECTING",
  unavailable: "INFERENCE: UNAVAILABLE",
};

export function RealtimeCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("connecting");
  const [connectionKey, setConnectionKey] = useState(0);
  const [frameSize, setFrameSize] = useState<string | null>(null);
  const [inferenceStatus, setInferenceStatus] = useState<InferenceStatus>("waiting");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const restart = useCallback(() => {
    setCameraStatus("reconnecting");
    setInferenceStatus("waiting");
    setConnectionKey((key) => key + 1);
  }, []);

  const reportInferenceStatus = useCallback((status: InferenceStatus) => {
    setInferenceStatus(status);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    const reportFrameSize = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setFrameSize(`${video.videoWidth} × ${video.videoHeight}`);
      }
    };
    const scheduleRetry = () => {
      if (cancelled || retryRef.current) return;
      setCameraStatus("reconnecting");
      setInferenceStatus("reconnecting");
      retryRef.current = setTimeout(() => {
        retryRef.current = null;
        restart();
      }, 2_000);
    };
    const load = async () => {
      setCameraStatus("connecting");
      setInferenceStatus("waiting");
      try {
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({
            backBufferLength: 30,
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 15,
          });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            reportFrameSize();
            void video.play().catch(() => scheduleRetry());
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls?.startLoad();
              scheduleRetry();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls?.recoverMediaError();
              scheduleRetry();
            } else {
              setCameraStatus("unavailable");
              setInferenceStatus("unavailable");
            }
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
        setCameraStatus("unavailable");
        setInferenceStatus("unavailable");
      } catch {
        if (!cancelled) scheduleRetry();
      }
    };

    const onPlaying = () => {
      reportFrameSize();
      setCameraStatus("live");
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadedmetadata", reportFrameSize);
    video.addEventListener("error", scheduleRetry);
    void load();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = null;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadedmetadata", reportFrameSize);
      video.removeEventListener("error", scheduleRetry);
    };
  }, [connectionKey, restart]);

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === viewportRef.current);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewportRef.current?.requestFullscreen();
    } catch {
      // Fullscreen is an enhancement; no camera or inference state changes if it is unavailable.
    }
  };

  const cameraLabel = {
    connecting: "CONNECTING // WEST STREET @ W34 ST",
    live: "FEED LIVE // WEST STREET @ W34 ST",
    reconnecting: "RECONNECTING // WEST STREET @ W34 ST",
    unavailable: "CAMERA UNAVAILABLE // WEST STREET @ W34 ST",
  }[cameraStatus];

  return (
    <section className="realtime-camera" aria-label="Realtime camera">
      <div className="realtime-statusbar">
        <span><i className={`status-dot status-dot--${cameraStatus}`} />{cameraLabel}</span>
        <span>{inferenceLabels[inferenceStatus]}</span>
      </div>
      <div ref={viewportRef} className="realtime-viewport">
        <video ref={videoRef} autoPlay muted playsInline crossOrigin="anonymous" />
        {cameraStatus !== "live" && (
          <div className="realtime-wait">
            {cameraStatus === "unavailable" ? "CAMERA SOURCE UNAVAILABLE" : "AWAITING LIVE CAMERA"}
          </div>
        )}
        {cameraStatus === "live" && (
          <RealtimeInference
            connectionKey={connectionKey}
            onStatusChange={reportInferenceStatus}
            sourceVideoRef={videoRef}
          />
        )}
        <button type="button" className="realtime-fullscreen-button" onClick={() => void toggleFullscreen()}>
          {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
      </div>
    </section>
  );
}
