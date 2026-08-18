"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import {
  countPredictionsForOutput,
  footPointsFromOutput,
  occupiedStripesFromAllDetections,
  type ClientCalibration,
  type OccupiedStripe,
} from "@/lib/realtime-detections";
import { scalePolygon, type FrameSize, type Stripe } from "@/lib/realtime-calibration";
import { stripeKey } from "@/lib/realtime-scale";
import {
  createStartupTimingRecorder,
  emitPerformanceMeasures,
  logStartupSummary,
  type SessionType,
  type StartupSummary,
  type StartupTimingRecorder,
} from "@/lib/startup-timing";

export type InferenceStatus = "waiting" | "starting" | "active" | "reconnecting" | "unavailable";

type RealtimeInferenceProps = {
  // Audio is owned by RealtimeCamera so its sound control can render before
  // inference exists; this component only reads the refs while scheduling notes.
  // While muted, onData keeps the trigger set cleared, so re-enabling sound
  // never replays an event that fired during the silence.
  audioContextRef: { current: AudioContext | null };
  audioEnabledRef: { current: boolean };
  connectionKey: number;
  onActive: () => void;
  /** Reports detected pedestrian foot-points each frame, for the debug overlay. */
  onDetectionPoints: (points: [number, number][]) => void;
  onFrameSize: (size: FrameSize) => void;
  onStatusChange: (status: InferenceStatus, statusMessage?: string) => void;
  /** Called once per attempt with the final startup summary. */
  onStartupSummary: (summary: StartupSummary) => void;
  /** The session type for this connection attempt (initial, retry, etc.). */
  sessionType: SessionType;
  /** Timestamp from performance.now() when the page component mounted. */
  pageMountedAt: number;
  sourceVideoRef: RefObject<HTMLVideoElement | null>;
  /** Live calibration for client-side inside/outside classification. */
  calibration: ClientCalibration;
  /** Live stripe polygons from the calibration agent, or the baked-in reference. */
  stripes: readonly Stripe[];
};

type OutputBindings = {
  all: string;
};

type ConfigurationResponse =
  | { available: false; message: string }
  | { available: true; outputBindings: OutputBindings };

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

type CanvasCapture = {
  stream: MediaStream;
  stop: () => void;
};

/**
 * iOS WebKit does not implement HTMLVideoElement.captureStream(), but it DOES
 * support HTMLCanvasElement.captureStream(). This helper draws video frames to
 * an offscreen canvas using requestVideoFrameCallback (Safari 15.4+) and
 * returns the canvas's capture stream — a drop-in replacement for the native
 * video.captureStream() that Roboflow's WebRTC pipeline expects.
 *
 * The canvas is sized to the video's native dimensions so the downstream
 * stripe-overlay math stays intact.
 */
function createCanvasCapture(video: CapturableVideo, signal: AbortSignal): CanvasCapture {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;

  let stopped = false;
  let rafId: number | undefined;

  const pump = () => {
    if (stopped || signal.aborted) return;
    // Keep canvas sized to the video in case dimensions change mid-stream.
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(pump);
    } else {
      // Fallback for browsers without requestVideoFrameCallback — very
      // unlikely on modern Safari, but keeps the path safe.
      rafId = requestAnimationFrame(pump);
    }
  };

  // Kick off the first frame.
  if (video.requestVideoFrameCallback) {
    video.requestVideoFrameCallback(pump);
  } else {
    rafId = requestAnimationFrame(pump);
  }

  // Let the canvas capture at the display refresh rate. Each pump() call
  // draws a new frame, and the stream picks it up on its next capture cycle.
  const stream = canvas.captureStream();

  return {
    stream,
    stop: () => {
      stopped = true;
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

function waitForPlayableVideo(video: HTMLVideoElement, signal: AbortSignal) {
  if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const complete = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const cleanup = () => {
      video.removeEventListener("playing", complete);
      signal.removeEventListener("abort", abort);
    };
    video.addEventListener("playing", complete, { once: true });
    signal.addEventListener("abort", abort, { once: true });
  });
}

function noteFrequency(note: string) {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  if (!match) return 440;
  const [, letter, accidental, octaveText] = match;
  const naturalSemitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const semitone = naturalSemitones[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  const midi = (Number(octaveText) + 1) * 12 + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}

function playPianoNote(context: AudioContext, note: string) {
  const startedAt = context.currentTime;
  const envelope = context.createGain();
  const fundamental = context.createOscillator();
  const harmonic = context.createOscillator();
  const harmonicLevel = context.createGain();
  const frequency = noteFrequency(note);

  fundamental.type = "triangle";
  fundamental.frequency.setValueAtTime(frequency, startedAt);
  harmonic.type = "sine";
  harmonic.frequency.setValueAtTime(frequency * 2, startedAt);
  harmonicLevel.gain.setValueAtTime(0.14, startedAt);
  envelope.gain.setValueAtTime(0.0001, startedAt);
  envelope.gain.exponentialRampToValueAtTime(0.15, startedAt + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startedAt + 1.1);

  fundamental.connect(envelope);
  harmonic.connect(harmonicLevel);
  harmonicLevel.connect(envelope);
  envelope.connect(context.destination);
  fundamental.start(startedAt);
  harmonic.start(startedAt);
  fundamental.stop(startedAt + 1.12);
  harmonic.stop(startedAt + 1.12);
}

// TODO: restore to 20_000ms after testing
const BEAT_RESUME_DELAY_MS = 5_000;
// Orchestration uses a MembraneSynth at C2 on quarter notes at 96 BPM = 625ms.
const BEAT_INTERVAL_MS = 625;

/**
 * Membrane-style kick matching the Orchestration study's background beat:
 * MembraneSynth({ octaves: 2, pitchDecay: .02, envelope: { attack: .001,
 * decay: .07, release: .02 } }) at C2, velocity 0.11.
 *
 * Recreated in raw Web Audio: a sine oscillator whose frequency sweeps from
 * C4 (2 octaves up) down to C2 over 20ms — that fast pitch drop is what gives
 * a membrane synth its kick character.
 */
function playBeat(context: AudioContext) {
  const now = context.currentTime;
  const baseFreq = noteFrequency("C2");
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  // Pitch sweep: start 2 octaves up (C4), drop to C2 over 20ms.
  osc.frequency.setValueAtTime(baseFreq * 4, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.02);
  // Envelope: fast attack, short decay. Gain raised for testing.
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function RealtimeInference({
  audioContextRef,
  audioEnabledRef,
  calibration,
  connectionKey,
  onActive,
  onDetectionPoints,
  onFrameSize,
  onStatusChange,
  onStartupSummary,
  pageMountedAt,
  sessionType,
  sourceVideoRef,
  stripes: liveStripes,
}: RealtimeInferenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keyed by stripe, not by note: two stripes can play the same pitch once a
  // crosswalk reads long enough to overlap the other's range, and they must
  // still light and retrigger independently.
  const activeStripesRef = useRef(new Set<string>());
  const lastTriggeredAtRef = useRef(new Map<string, number>());
  // Beat state: plays when people are detected but none are in the crosswalk.
  const beatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInsideTimestampRef = useRef<number>(0);
  // Stall detection: if onData hasn't fired in this long, the data channel is
  // dead even though the SDK hasn't reported it. Trigger a reconnection.
  const lastDataAtRef = useRef<number>(0);
  const stallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STALL_TIMEOUT_MS = 15_000;
  const firstPredictionMarkedRef = useRef(false);
  // onData is created once per WebRTC connection and would otherwise capture
  // whatever calibration existed at that moment — which is the baked-in
  // reference, since the stream connects before the calibration fetch
  // resolves. Reading through a ref lets a drifted camera's new geometry take
  // effect without tearing down the connection every time it refreshes.
  const calibrationRef = useRef(calibration);
  useEffect(() => { calibrationRef.current = calibration; }, [calibration]);

  const [activeStripes, setActiveStripes] = useState<OccupiedStripe[]>([]);
  const [frame, setFrame] = useState<FrameSize | null>(null);
  const [insideCount, setInsideCount] = useState<number | null>(null);
  const [message, setMessage] = useState("Waiting for live camera");

  const clearOccupancy = () => {
    activeStripesRef.current.clear();
    setActiveStripes([]);
  };

  const startBeat = () => {
    if (beatIntervalRef.current) return; // already running
    const ctx = audioContextRef.current;
    if (!ctx || !audioEnabledRef.current) return;
    playBeat(ctx); // immediate first pulse
    beatIntervalRef.current = setInterval(() => {
      if (audioContextRef.current && audioEnabledRef.current) {
        playBeat(audioContextRef.current);
      }
    }, BEAT_INTERVAL_MS);
  };

  const stopBeat = () => {
    if (beatIntervalRef.current) {
      clearInterval(beatIntervalRef.current);
      beatIntervalRef.current = null;
    }
    if (beatResumeTimerRef.current) {
      clearTimeout(beatResumeTimerRef.current);
      beatResumeTimerRef.current = null;
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    let sourceStream: MediaStream | null = null;
    let canvasCapture: CanvasCapture | null = null;
    let connection: Awaited<ReturnType<typeof import("@roboflow/inference-sdk").webrtc.useStream>> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 2_000;

    const attempt = async (retryCount: number) => {
      const sourceVideo = sourceVideoRef.current as CapturableVideo | null;
      if (!sourceVideo || abortController.signal.aborted) return;
      clearOccupancy();
      firstPredictionMarkedRef.current = false;

      const timing = createStartupTimingRecorder({
        sessionType: retryCount > 0 ? "retry" : sessionType,
        connectionKey,
        retryCount,
        pageMountedAt,
      });
      timing.mark("attempt_start");

      if (retryCount === 0) {
        setFrame(null);
        setInsideCount(null);
        onStatusChange("starting");
        setMessage("Connecting to pedestrian inference");
      } else {
        onStatusChange("reconnecting");
        setMessage(`Reconnecting to inference (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      }

      try {
        const configResponse = await fetch("/api/roboflow/realtime-config", {
          cache: "no-store",
          signal: abortController.signal,
        });
        const configuration = await configResponse.json() as ConfigurationResponse;
        timing.mark("config_loaded");
        if (!configuration.available) {
          timing.fail();
          const s = timing.summary();
          logStartupSummary(s);
          onStartupSummary(s);
          onStatusChange("unavailable");
          setMessage(configuration.message);
          return;
        }

        await waitForPlayableVideo(sourceVideo, abortController.signal);
        timing.mark("video_playable");

        // Prefer the native zero-copy path (Chrome/Edge), fall back to a
        // canvas pump on WebKit (iOS Safari/Chrome) where video.captureStream
        // is not implemented.
        const nativeCaptureStream = sourceVideo.captureStream ?? sourceVideo.mozCaptureStream;
        if (nativeCaptureStream) {
          sourceStream = nativeCaptureStream.call(sourceVideo);
        } else if (sourceVideo.videoWidth > 0) {
          canvasCapture = createCanvasCapture(sourceVideo, abortController.signal);
          sourceStream = canvasCapture.stream;
        } else {
          throw new Error("This browser cannot capture the HLS video stream");
        }
        const sourceTrack = sourceStream.getVideoTracks()[0];
        if (!sourceTrack) throw new Error("The HLS video did not provide a video track");
        const settings = sourceTrack.getSettings();
        const inputFrame = {
          width: Math.round(settings.width ?? sourceVideo.videoWidth),
          height: Math.round(settings.height ?? sourceVideo.videoHeight),
        };
        if (inputFrame.width < 1 || inputFrame.height < 1) throw new Error("The HLS video did not report dimensions");
        setFrame(inputFrame);
        onFrameSize(inputFrame);

        const { connectors, webrtc } = await import("@roboflow/inference-sdk");
        connection = await webrtc.useStream({
          source: sourceStream,
          connector: connectors.withProxyUrl(
            "/api/roboflow/webrtc",
            { turnConfigUrl: "/api/roboflow/turn" }
          ),
          wrtcParams: {},
          onData: (data) => {
            lastDataAtRef.current = performance.now();
            if (!firstPredictionMarkedRef.current) {
              firstPredictionMarkedRef.current = true;
              timing.mark("first_predictions");
              const s = { ...timing.summary(), outcome: "success" as const };
              emitPerformanceMeasures(s);
              logStartupSummary(s);
              onStartupSummary(s);
            }
            const output = data.serialized_output_data;

            // Client-side classification: read ALL detections and test each
            // foot-point against the live calibration stripes and boundaries.
            // This replaces the server-side polygon filtering that Roboflow
            // used to do, so the boundaries are always from the latest
            // calibration agent run rather than what was set at session init.
            const occupied = occupiedStripesFromAllDetections(
              output, configuration.outputBindings.all, inputFrame, calibrationRef.current,
            );
            setActiveStripes(occupied);

            const totalPeople = countPredictionsForOutput(output, configuration.outputBindings.all);
            const insideNow = occupied.length;
            setInsideCount(insideNow);

            // Report all foot-points for the debug overlay.
            const allPoints = footPointsFromOutput(output, configuration.outputBindings.all);
            onDetectionPoints(allPoints);

            if (!audioEnabledRef.current || !audioContextRef.current) {
              activeStripesRef.current.clear();
              stopBeat();
              return;
            }

            // --- Beat logic ---------------------------------------------------
            // Play a subtle beat when people are detected outside the crosswalk
            // but none are inside it — the intersection is "listening" but no
            // one is playing. Stop the beat the moment someone enters the
            // crosswalk. Resume after 20 seconds of nobody inside.
            const now = performance.now();

            if (insideNow > 0) {
              // Someone is playing — stop the beat.
              stopBeat();
              lastInsideTimestampRef.current = now;
            } else if (totalPeople > 0 && !beatIntervalRef.current) {
              // People detected but none inside. Start (or schedule) the beat.
              const elapsed = now - lastInsideTimestampRef.current;
              if (lastInsideTimestampRef.current === 0 || elapsed >= BEAT_RESUME_DELAY_MS) {
                // Either first time or 20s has passed — start immediately.
                startBeat();
              } else if (!beatResumeTimerRef.current) {
                // Schedule the beat to resume after the remaining delay.
                const remaining = BEAT_RESUME_DELAY_MS - elapsed;
                beatResumeTimerRef.current = setTimeout(() => {
                  beatResumeTimerRef.current = null;
                  startBeat();
                }, remaining);
              }
            } else if (totalPeople === 0) {
              // Nobody in frame at all — silence.
              stopBeat();
            }

            // --- Note triggers ------------------------------------------------
            for (const stripe of occupied) {
              const lastTriggeredAt = lastTriggeredAtRef.current.get(stripe.key) ?? 0;
              if (!activeStripesRef.current.has(stripe.key) && now - lastTriggeredAt >= 600) {
                playPianoNote(audioContextRef.current, stripe.note);
                lastTriggeredAtRef.current.set(stripe.key, now);
              }
            }
            activeStripesRef.current = new Set(occupied.map((stripe) => stripe.key));
          },
        });
        timing.mark("gpu_ready");
        if (abortController.signal.aborted) {
          await connection.cleanup();
          return;
        }
        onStatusChange("active");
        setMessage("Pedestrian inference live");
        onActive();

        // Start stall detection: if onData stops firing for 15s while the
        // connection is supposedly active, the data channel has silently died
        // (the SDK logs "Data channel error" but doesn't throw or close).
        lastDataAtRef.current = performance.now();
        stallTimerRef.current = setInterval(() => {
          if (performance.now() - lastDataAtRef.current > STALL_TIMEOUT_MS) {
            if (stallTimerRef.current) clearInterval(stallTimerRef.current);
            stallTimerRef.current = null;
            // Force cleanup and retry by throwing into the catch block's
            // retry path. We do this by cleaning up and re-entering attempt().
            if (connection) { void connection.cleanup(); connection = null; }
            if (canvasCapture) { canvasCapture.stop(); canvasCapture = null; }
            if (sourceStream) { sourceStream.getTracks().forEach((track) => track.stop()); sourceStream = null; }
            clearOccupancy();
            stopBeat();
            void attempt(retryCount + 1 > MAX_RETRIES ? 0 : retryCount);
          }
        }, 5_000);
      } catch (error) {
        if (abortController.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        clearOccupancy();
        stopBeat();
        if (stallTimerRef.current) { clearInterval(stallTimerRef.current); stallTimerRef.current = null; }

        // Clean up the failed connection before retrying.
        if (connection) { void connection.cleanup(); connection = null; }
        else sourceStream?.getTracks().forEach((track) => track.stop());
        if (canvasCapture) { canvasCapture.stop(); canvasCapture = null; }
        sourceStream = null;

        // Non-retryable errors: stop immediately instead of burning through
        // retries that will all fail the same way.
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNonRetryable = /402|payment|quota|billing/i.test(errorMessage);

        if (isNonRetryable) {
          timing.fail();
          logStartupSummary(timing.summary());
          onStartupSummary(timing.summary());
          onStatusChange("unavailable");
          setMessage("Roboflow GPU quota exceeded");
        } else if (retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * 2 ** retryCount; // 2s, 4s, 8s, 16s, 32s
          const retryMsg = `RECONNECTING ${retryCount + 1}/${MAX_RETRIES}...`;
          onStatusChange("reconnecting", retryMsg);
          setMessage(`Inference failed, retrying in ${Math.round(delay / 1000)}s...`);
          retryTimer = setTimeout(() => {
            retryTimer = null;
            void attempt(retryCount + 1);
          }, delay);
        } else {
          timing.fail();
          logStartupSummary(timing.summary());
          onStartupSummary(timing.summary());
          onStatusChange("unavailable");
          setMessage(errorMessage || "Realtime inference unavailable");
        }
      }
    };

    void attempt(0);
    return () => {
      abortController.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (stallTimerRef.current) { clearInterval(stallTimerRef.current); stallTimerRef.current = null; }
      clearOccupancy();
      stopBeat();
      if (connection) void connection.cleanup();
      else sourceStream?.getTracks().forEach((track) => track.stop());
      if (canvasCapture) canvasCapture.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- startBeat/stopBeat only use stable refs
  }, [audioContextRef, audioEnabledRef, connectionKey, onActive, onDetectionPoints, onFrameSize, onStartupSummary, onStatusChange, pageMountedAt, sessionType, sourceVideoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      // The video element uses object-fit: contain normally and object-fit:
      // cover in pseudo-fullscreen.  The overlay must match the same mapping so
      // stripe polygons land on top of the actual crosswalk.  Contain scales the
      // video to fit inside the viewport (positive offsets = letterbox).  Cover
      // scales the video to fill the viewport (negative offsets = crop).
      const useCover = canvas.closest(".realtime-viewport--pseudo-fullscreen") !== null;
      const sourceAspect = frame.width / frame.height;
      const viewportAspect = bounds.width / bounds.height;
      const wider = sourceAspect > viewportAspect;
      const contentWidth  = (wider === useCover) ? bounds.height * sourceAspect : bounds.width;
      const contentHeight = (wider === useCover) ? bounds.height : bounds.width / sourceAspect;
      const offsetX = (bounds.width - contentWidth) / 2;
      const offsetY = (bounds.height - contentHeight) / 2;
      const scaleX = contentWidth / frame.width;
      const scaleY = contentHeight / frame.height;
      const occupiedKeys = new Set(activeStripes.map((stripe) => stripe.key));

      const tracePath = (ctx: CanvasRenderingContext2D, points: [number, number][]) => {
        const [first, ...rest] = points;
        if (!first) return;
        ctx.beginPath();
        ctx.moveTo(offsetX + first[0] * scaleX, offsetY + first[1] * scaleY);
        for (const pt of rest) ctx.lineTo(offsetX + pt[0] * scaleX, offsetY + pt[1] * scaleY);
        ctx.closePath();
      };

      // Glow is built from three shadow passes at increasing radii, drawn
      // lightest-and-widest first so the layers composite additively.
      //
      // Each layer is rendered on an offscreen canvas at 1:1 CSS-pixel
      // resolution (no DPR scaling) using the shadow-offset trick: the
      // fill itself is translated far off-canvas so only its shadow is
      // visible at the original position.  This avoids two cross-browser
      // issues with the previous ctx.filter approach:
      //   1. Safari/WebKit ignores ctx.filter or applies blur in canvas-
      //      pixel space after setTransform, producing hard edges on 2×/3×
      //      mobile displays.
      //   2. shadowBlur is universally supported and operates in the
      //      offscreen canvas's native pixel space, which equals CSS
      //      pixels here — consistent across all DPR values.
      // The offscreen result is composited onto the main DPR-scaled canvas
      // via drawImage, which handles the upscale.
      const offW = Math.ceil(bounds.width);
      const offH = Math.ceil(bounds.height);
      let offscreen = glowCanvasRef.current;
      if (!offscreen || offscreen.width !== offW || offscreen.height !== offH) {
        offscreen = document.createElement("canvas");
        offscreen.width = offW;
        offscreen.height = offH;
        glowCanvasRef.current = offscreen;
      }
      const offCtx = offscreen.getContext("2d");

      if (offCtx) {
        offCtx.clearRect(0, 0, offW, offH);
        const SHADOW_OFFSET = 10_000;

        const glowLayers: Array<{ blur: number; fill: string }> = [
          { blur: 20, fill: "rgba(148, 215, 181, 0.15)" },  // wide halo
          { blur: 10, fill: "rgba(148, 215, 181, 0.25)" },  // medium bloom
          { blur: 3,  fill: "rgba(148, 215, 181, 0.45)" },  // tight core
        ];

        for (const stripe of liveStripes) {
          if (!occupiedKeys.has(stripeKey(stripe.segment, stripe.stripeIndex))) continue;
          const points = scalePolygon(stripe.polygon, calibration.referenceFrame, frame);
          if (points.length < 3) continue;

          for (const layer of glowLayers) {
            offCtx.save();
            offCtx.shadowColor = layer.fill;
            offCtx.shadowBlur = layer.blur * scaleX;
            offCtx.shadowOffsetX = SHADOW_OFFSET;
            offCtx.shadowOffsetY = SHADOW_OFFSET;
            offCtx.translate(-SHADOW_OFFSET, -SHADOW_OFFSET);
            tracePath(offCtx, points);
            // Full-opacity fill so shadow alpha comes from shadowColor alone;
            // the fill itself is 10 000 px off-canvas and invisible.
            offCtx.fillStyle = "rgba(148, 215, 181, 1)";
            offCtx.fill();
            offCtx.restore();
          }
        }

        // Composite the 1:1 glow layer onto the DPR-scaled main canvas.
        context.drawImage(offscreen, 0, 0);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [activeStripes, calibration.referenceFrame, frame, liveStripes]);

  return (
    <>
      <canvas ref={canvasRef} className="realtime-overlay" aria-label="Occupied crosswalk stripe overlay" />
      <p className="visually-hidden" aria-live="polite">
        {message}
        {frame && ` Input ${frame.width} by ${frame.height}.`}
        {insideCount !== null && ` ${insideCount} people inside the crosswalk.`}
        {activeStripes.length > 0 && ` Active notes: ${activeStripes.map((s) => s.note).join(", ")}.`}
      </p>
    </>
  );
}
