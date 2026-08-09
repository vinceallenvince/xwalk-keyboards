"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RealtimeDebug } from "@/components/realtime-debug";
import { RealtimeInference, type InferenceStatus } from "@/components/realtime-inference";
import { useCalibration } from "@/lib/use-calibration";
import type { FrameSize } from "@/lib/realtime-calibration";

type CameraStatus = "connecting" | "live" | "reconnecting" | "unavailable";

const streamUrl = "/api/hls/5056/playlist.m3u8";

const cameraLabels: Record<CameraStatus, string> = {
  connecting: "CONNECTING // WEST STREET @ W34 ST",
  live: "FEED LIVE // WEST STREET @ W34 ST",
  reconnecting: "FEED RECONNECTING // WEST STREET @ W34 ST",
  unavailable: "FEED DOWN // WEST STREET @ W34 ST",
};

const inferenceLabels: Record<InferenceStatus, string> = {
  waiting: "STARTING ROBOFLOW GPU...",
  starting: "STARTING ROBOFLOW GPU...",
  active: "STATUS: ROBOFLOW ACTIVE",
  reconnecting: "STATUS: ROBOFLOW RECONNECTING",
  unavailable: "STATUS: ROBOFLOW UNAVAILABLE",
};

export function RealtimeCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Audio is owned here, not in RealtimeInference, so the sound control can be
  // rendered (inactive) alongside FULLSCREEN before inference has started.
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioEnabledRef = useRef(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("connecting");
  const [connectionKey, setConnectionKey] = useState(0);
  const [inferenceStatus, setInferenceStatus] = useState<InferenceStatus>("waiting");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frameSize, setFrameSize] = useState<FrameSize | null>(null);
  const [detectionPoints, setDetectionPoints] = useState<[number, number][]>([]);
  const [forcedUnavailable, setForcedUnavailable] = useState(false);
  const calibration = useCalibration(5056);

  const reportFrameSize = useCallback((size: FrameSize) => setFrameSize(size), []);
  const reportDetectionPoints = useCallback((points: [number, number][]) => setDetectionPoints(points), []);

  const restart = useCallback(() => {
    setCameraStatus("reconnecting");
    setInferenceStatus("waiting");
    setConnectionKey((key) => key + 1);
  }, []);

  const reportInferenceStatus = useCallback((status: InferenceStatus) => {
    setInferenceStatus(status);
  }, []);

  const enableAudio = useCallback(async () => {
    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await context.resume();
      audioEnabledRef.current = true;
      setAudioEnabled(true);
      setAudioMessage(null);
    } catch {
      setAudioMessage("Browser audio could not start");
    }
  }, []);

  const disableAudio = useCallback(async () => {
    audioEnabledRef.current = false;
    setAudioEnabled(false);
    await audioContextRef.current?.suspend();
  }, []);

  const toggleAudio = useCallback(() => {
    void (audioEnabledRef.current ? disableAudio() : enableAudio());
  }, [disableAudio, enableAudio]);

  // Sound comes on by itself once inference is live. The visitor reached this
  // route by clicking through, which satisfies the browser gesture requirement.
  const handleInferenceActive = useCallback(() => {
    if (!audioEnabledRef.current) void enableAudio();
  }, [enableAudio]);

  useEffect(() => () => {
    audioEnabledRef.current = false;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: import("hls.js").default | null = null;
    let cancelled = false;

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

    const onPlaying = () => setCameraStatus("live");
    video.addEventListener("playing", onPlaying);
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

  const effectiveCamera = forcedUnavailable ? "unavailable" as CameraStatus : cameraStatus;
  const isLive = effectiveCamera === "live";
  const soundReady = inferenceStatus === "active" && !forcedUnavailable;
  const [recalibrating, setRecalibrating] = useState(false);

  const handleRecalibrate = useCallback(async () => {
    const video = videoRef.current;
    if (!video || recalibrating) return;

    setRecalibrating(true);
    try {
      // Capture a frame from the live video as a PNG blob.
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 352;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      const form = new FormData();
      form.set("frame", blob, "frame.png");

      const response = await fetch("/api/calibration/recalibrate", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });

      if (response.ok) {
        // The agent published to GCS; force the hook to re-fetch immediately.
        // A full re-fetch picks up both stripes and boundaries.
        window.dispatchEvent(new Event("calibration-updated"));
      }
    } catch {
      // Recalibration is best-effort; the next scheduled run will catch it.
    } finally {
      setRecalibrating(false);
    }
  }, [recalibrating]);

  return (
    <section className="realtime-camera" aria-label="Realtime camera">
      <div className="realtime-statusbar">
        <span className={`realtime-feed-status realtime-feed-status--${effectiveCamera}`}>
          <i className={`status-dot status-dot--${effectiveCamera}`} />
          {cameraLabels[effectiveCamera]}
          {isLive && (
            <>
              <span className="realtime-recalibrate-sep">{" // "}</span>
              <button
                type="button"
                className={`realtime-recalibrate${recalibrating ? " realtime-recalibrate--running" : ""}`}
                onClick={() => void handleRecalibrate()}
                disabled={recalibrating}
              >
                {recalibrating ? "CALIBRATING..." : "RECALIBRATE"}
              </button>
            </>
          )}
        </span>
        <span className={`realtime-inference-status realtime-inference-status--${effectiveCamera === "unavailable" ? "unavailable" : inferenceStatus}`}>
          {effectiveCamera === "unavailable" ? "FEED UNAVAILABLE" : inferenceLabels[inferenceStatus]}
        </span>
      </div>
      <div ref={viewportRef} className="realtime-viewport">
        <video ref={videoRef} autoPlay muted playsInline crossOrigin="anonymous" />
        {effectiveCamera === "unavailable" && (
          <div className="realtime-unavailable-overlay">
            <p className="realtime-unavailable-title">VIDEO FEED UNAVAILABLE</p>
            <p className="realtime-unavailable-subtitle">The camera feed for this intersection is currently offline.</p>
          </div>
        )}
        {isLive && (
          <RealtimeInference
            audioContextRef={audioContextRef}
            audioEnabledRef={audioEnabledRef}
            connectionKey={connectionKey}
            onActive={handleInferenceActive}
            onDetectionPoints={reportDetectionPoints}
            onFrameSize={reportFrameSize}
            onStatusChange={reportInferenceStatus}
            sourceVideoRef={videoRef}
            stripes={calibration.stripes}
          />
        )}
        <div className={`realtime-controls${isLive ? "" : " realtime-controls--idle"}`}>
          <button
            type="button"
            className={`realtime-control realtime-fullscreen-button${isLive ? " realtime-fullscreen-button--ready" : ""}`}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
          </button>
          <button
            type="button"
            className={`realtime-control realtime-sound-button${audioEnabled ? " realtime-sound-button--on" : ""}`}
            onClick={toggleAudio}
            disabled={!soundReady}
            aria-pressed={audioEnabled}
          >
            <i aria-hidden="true" className="realtime-sound-button__dot" />
            {audioEnabled ? "SOUND ON" : "SOUND OFF"}
          </button>
        </div>
        <RealtimeDebug
          calibration={calibration}
          detectionPoints={detectionPoints}
          forcedUnavailable={forcedUnavailable}
          frame={frameSize}
          onClearUnavailable={() => setForcedUnavailable(false)}
          onForceUnavailable={() => setForcedUnavailable(true)}
          viewportRef={viewportRef}
        />
      </div>
      {audioMessage && <p className="visually-hidden" aria-live="polite">{audioMessage}</p>}
    </section>
  );
}
