"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RealtimeDebug } from "@/components/realtime-debug";
import { RealtimeInference, type InferenceStatus } from "@/components/realtime-inference";
import {
  RealtimeOnboardingOverlay,
  useReportPredictions,
  useSetOnboardingBlocked,
} from "@/components/realtime-onboarding";
import type { LiveCameraRecord } from "@/data/cameras";
import { useCalibration } from "@/lib/use-calibration";
import type { FrameSize } from "@/lib/realtime-calibration";

type CameraStatus = "connecting" | "live" | "reconnecting" | "unavailable";

const INFERENCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const cameraLabels = (statusLabel: string): Record<CameraStatus, string> => ({
  connecting: `CONNECTING // ${statusLabel}`,
  live: `FEED LIVE // ${statusLabel}`,
  reconnecting: `FEED RECONNECTING // ${statusLabel}`,
  unavailable: `FEED DOWN // ${statusLabel}`,
});

// The two status lines speak from two points of view: the feed line is the
// camera, this one is the instrument. A visitor cannot act on the name of the
// GPU vendor behind it, but "the keyboard is warming up" tells them exactly
// what they are waiting for. The underlying inference states are unchanged.
const inferenceLabels: Record<InferenceStatus, string> = {
  waiting: "STATUS: KEYBOARD WARMING UP...",
  starting: "STATUS: KEYBOARD WARMING UP...",
  active: "STATUS: KEYBOARD READY!",
  reconnecting: "STATUS: KEYBOARD RECONNECTING",
  unavailable: "STATUS: KEYBOARD UNAVAILABLE",
};

export function RealtimeCamera({ camera }: { camera: LiveCameraRecord }) {
  const streamUrl = `/api/hls/${camera.cameraId}/playlist.m3u8`;
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
  const [inferenceMessage, setInferenceMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [frameSize, setFrameSize] = useState<FrameSize | null>(null);
  const [detectionPoints, setDetectionPoints] = useState<[number, number][]>([]);
  const [forcedUnavailable, setForcedUnavailable] = useState(false);
  const [inferenceTimedOut, setInferenceTimedOut] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [inferenceClosed, setInferenceClosed] = useState(false);
  const inferenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { calibration, applyCalibration } = useCalibration(camera);
  const setOnboardingBlocked = useSetOnboardingBlocked();
  const reportPredictions = useReportPredictions();

  // The pause modal owns the viewport for as long as it is up: the onboarding
  // is neither shown over it nor summonable from the header icon. Every path
  // that shows or hides it goes through here so the two cannot drift apart.
  const setPauseModal = useCallback((next: boolean) => {
    setShowPauseModal(next);
    setOnboardingBlocked(next);
  }, [setOnboardingBlocked]);

  const reportFrameSize = useCallback((size: FrameSize) => setFrameSize(size), []);
  // Every prediction frame lands here, so this doubles as the "the app is
  // receiving predictions" signal that dismisses the onboarding overlay.
  const reportDetectionPoints = useCallback((points: [number, number][]) => {
    reportPredictions();
    setDetectionPoints(points);
  }, [reportPredictions]);

  const restart = useCallback(() => {
    setCameraStatus("reconnecting");
    setInferenceStatus("waiting");
    setConnectionKey((key) => key + 1);
  }, []);

  const reportInferenceStatus = useCallback((status: InferenceStatus, statusMessage?: string) => {
    setInferenceStatus(status);
    setInferenceMessage(statusMessage ?? null);
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
    // Start the 5-minute usage timer when inference first goes active.
    // Don't restart if already timed out (user clicked Continue, timer resets below).
    if (!inferenceTimerRef.current && !inferenceTimedOut && !inferenceClosed) {
      inferenceTimerRef.current = setTimeout(() => {
        inferenceTimerRef.current = null;
        setInferenceTimedOut(true);
        setPauseModal(true);
        void disableAudio();
      }, INFERENCE_TIMEOUT_MS);
    }
  }, [disableAudio, enableAudio, inferenceClosed, inferenceTimedOut, setPauseModal]);

  const handlePauseContinue = useCallback(() => {
    setPauseModal(false);
    setInferenceTimedOut(false);
    // Restart inference by bumping the connection key.
    setConnectionKey((key) => key + 1);
    // The timer restarts in handleInferenceActive when the new connection goes active.
  }, [setPauseModal]);

  const handlePauseClose = useCallback(() => {
    setPauseModal(false);
    setInferenceClosed(true);
  }, [setPauseModal]);

  useEffect(() => () => {
    audioEnabledRef.current = false;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    if (inferenceTimerRef.current) clearTimeout(inferenceTimerRef.current);
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
  }, [connectionKey, restart, streamUrl]);

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
  const inferenceAllowed = isLive && !inferenceTimedOut && !inferenceClosed;
  const soundReady = inferenceStatus === "active" && !forcedUnavailable && !inferenceTimedOut && !inferenceClosed;
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
      form.set("cameraId", String(camera.cameraId));

      const response = await fetch("/api/calibration/recalibrate", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      });

      if (response.ok) {
        // Apply the agent's response directly to state — no GCS round-trip.
        // This gives instant feedback in the debug panel and also works in
        // local dev where the GCS proxy can't authenticate.
        const result = await response.json();
        if (result.stripes?.length) {
          applyCalibration(result);
        }
      }
    } catch {
      // Recalibration is best-effort; the next scheduled run will catch it.
    } finally {
      setRecalibrating(false);
    }
  }, [applyCalibration, camera.cameraId, recalibrating]);

  return (
    <section className="realtime-camera" aria-label="Realtime camera">
      <div className="realtime-statusbar">
        <span className={`realtime-feed-status realtime-feed-status--${effectiveCamera}`}>
          <i className={`status-dot status-dot--${effectiveCamera}`} />
          {cameraLabels(camera.statusLabel)[effectiveCamera]}
        </span>
        <span className={`realtime-inference-status ${
          effectiveCamera === "unavailable" ? "realtime-inference-status--unavailable"
          : inferenceClosed ? "realtime-inference-status--paused"
          : inferenceTimedOut ? "realtime-inference-status--paused"
          : `realtime-inference-status--${inferenceStatus}`
        }`}>
          {/* A camera outage is not the keyboard's fault, so this line defers
              to the real cause rather than blaming the instrument. */}
          {effectiveCamera === "unavailable" ? "FEED UNAVAILABLE"
           : inferenceClosed ? "XWALK KEYBOARD PAUSED: RELOAD TO CONTINUE"
           : inferenceTimedOut ? "XWALK KEYBOARD PAUSED"
           : inferenceMessage ?? inferenceLabels[inferenceStatus]}
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
        {inferenceAllowed && (
          <RealtimeInference
            audioContextRef={audioContextRef}
            audioEnabledRef={audioEnabledRef}
            calibration={{
              stripes: calibration.stripes,
              boundaries: calibration.boundaries,
              referenceFrame: calibration.referenceFrame,
            }}
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
        <RealtimeOnboardingOverlay calibration={calibration} />
        {showPauseModal && (
          <>
            <div className="realtime-pause-scrim" />
            <div className="realtime-pause-modal" role="dialog" aria-label="XWalk Keyboard paused">
              <p className="realtime-pause-modal__title">XWALK KEYBOARD PAUSED</p>
              <p className="realtime-pause-modal__subtitle">
                To conserve resources, the XWalk Keyboard has been paused<br />after five minutes.
              </p>
              <div className="realtime-pause-modal__buttons">
                <button type="button" className="realtime-pause-modal__btn" onClick={handlePauseClose}>CLOSE</button>
                <button type="button" className="realtime-pause-modal__btn realtime-pause-modal__btn--continue" onClick={handlePauseContinue}>CONTINUE</button>
              </div>
            </div>
          </>
        )}
        <RealtimeDebug
          calibration={calibration}
          detectionPoints={detectionPoints}
          forcedUnavailable={forcedUnavailable}
          frame={frameSize}
          onClearUnavailable={() => setForcedUnavailable(false)}
          onForceUnavailable={() => setForcedUnavailable(true)}
          onForcePause={() => {
            if (inferenceTimerRef.current) { clearTimeout(inferenceTimerRef.current); inferenceTimerRef.current = null; }
            setInferenceTimedOut(true);
            setPauseModal(true);
            void disableAudio();
          }}
          onRecalibrate={() => void handleRecalibrate()}
          recalibrating={recalibrating}
          viewportRef={viewportRef}
        />
      </div>
      {audioMessage && <p className="visually-hidden" aria-live="polite">{audioMessage}</p>}
    </section>
  );
}
