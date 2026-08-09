"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import {
  countPredictionsForOutput,
  footPointsFromOutput,
  occupiedNotesFromRealtimeOutputs,
} from "@/lib/realtime-detections";
import { REALTIME_CALIBRATION, scalePolygon, type FrameSize, type Stripe } from "@/lib/realtime-calibration";

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
  onStatusChange: (status: InferenceStatus) => void;
  sourceVideoRef: RefObject<HTMLVideoElement | null>;
  /** Live stripe polygons from the calibration agent, or the baked-in reference. */
  stripes: readonly Stripe[];
};

type OutputBindings = {
  all: string;
  insideLeft: string;
  insideRight: string;
  outside: string;
};

type ConfigurationResponse =
  | { available: false; message: string }
  | { available: true; outputBindings: OutputBindings };

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

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
  connectionKey,
  onActive,
  onDetectionPoints,
  onFrameSize,
  onStatusChange,
  sourceVideoRef,
  stripes: liveStripes,
}: RealtimeInferenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeNotesRef = useRef(new Set<string>());
  const lastTriggeredAtRef = useRef(new Map<string, number>());
  // Beat state: plays when people are detected but none are in the crosswalk.
  const beatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beatResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInsideTimestampRef = useRef<number>(0);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const [frame, setFrame] = useState<FrameSize | null>(null);
  const [insideCount, setInsideCount] = useState<number | null>(null);
  const [message, setMessage] = useState("Waiting for live camera");

  const clearOccupancy = () => {
    activeNotesRef.current.clear();
    setActiveNotes([]);
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
    let connection: Awaited<ReturnType<typeof import("@roboflow/inference-sdk").webrtc.useStream>> | null = null;

    const start = async () => {
      const sourceVideo = sourceVideoRef.current as CapturableVideo | null;
      if (!sourceVideo) return;
      clearOccupancy();
      setFrame(null);
      setInsideCount(null);
      onStatusChange("starting");
      setMessage("Connecting to pedestrian inference");

      try {
        const configResponse = await fetch("/api/roboflow/realtime-config", {
          cache: "no-store",
          signal: abortController.signal,
        });
        const configuration = await configResponse.json() as ConfigurationResponse;
        if (!configuration.available) {
          onStatusChange("unavailable");
          setMessage(configuration.message);
          return;
        }

        await waitForPlayableVideo(sourceVideo, abortController.signal);
        const captureStream = sourceVideo.captureStream ?? sourceVideo.mozCaptureStream;
        if (!captureStream) throw new Error("This browser cannot capture the HLS video stream");
        sourceStream = captureStream.call(sourceVideo);
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
            `/api/roboflow/webrtc?frameWidth=${inputFrame.width}&frameHeight=${inputFrame.height}`,
            { turnConfigUrl: "/api/roboflow/turn" }
          ),
          wrtcParams: {},
          onData: (data) => {
            const output = data.serialized_output_data;
            const notes = occupiedNotesFromRealtimeOutputs(output, configuration.outputBindings, inputFrame);
            const occupied = new Set(notes);
            setActiveNotes(notes);

            const insideNow =
              countPredictionsForOutput(output, configuration.outputBindings.insideLeft) +
              countPredictionsForOutput(output, configuration.outputBindings.insideRight);
            setInsideCount(insideNow);

            const totalPeople = countPredictionsForOutput(output, configuration.outputBindings.all);

            // Report all foot-points for the debug overlay.
            const allPoints = [
              ...footPointsFromOutput(output, configuration.outputBindings.insideLeft),
              ...footPointsFromOutput(output, configuration.outputBindings.insideRight),
            ];
            onDetectionPoints(allPoints);

            if (!audioEnabledRef.current || !audioContextRef.current) {
              activeNotesRef.current.clear();
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
            for (const note of occupied) {
              const lastTriggeredAt = lastTriggeredAtRef.current.get(note) ?? 0;
              if (!activeNotesRef.current.has(note) && now - lastTriggeredAt >= 600) {
                playPianoNote(audioContextRef.current, note);
                lastTriggeredAtRef.current.set(note, now);
              }
            }
            activeNotesRef.current = occupied;
          },
        });
        if (abortController.signal.aborted) {
          await connection.cleanup();
          return;
        }
        onStatusChange("active");
        setMessage("Pedestrian inference live");
        onActive();
      } catch (error) {
        if (abortController.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        clearOccupancy();
        onStatusChange("unavailable");
        setMessage(error instanceof Error ? error.message : "Realtime inference unavailable");
      }
    };

    void start();
    return () => {
      abortController.abort();
      clearOccupancy();
      stopBeat();
      if (connection) void connection.cleanup();
      else sourceStream?.getTracks().forEach((track) => track.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- startBeat/stopBeat only use stable refs
  }, [audioContextRef, audioEnabledRef, connectionKey, onActive, onDetectionPoints, onFrameSize, onStatusChange, sourceVideoRef]);

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

      const sourceAspect = frame.width / frame.height;
      const viewportAspect = bounds.width / bounds.height;
      const contentWidth = sourceAspect > viewportAspect ? bounds.width : bounds.height * sourceAspect;
      const contentHeight = sourceAspect > viewportAspect ? bounds.width / sourceAspect : bounds.height;
      const offsetX = (bounds.width - contentWidth) / 2;
      const offsetY = (bounds.height - contentHeight) / 2;
      const scaleX = contentWidth / frame.width;
      const scaleY = contentHeight / frame.height;
      const notes = new Set(activeNotes);

      const tracePath = (ctx: CanvasRenderingContext2D, points: [number, number][]) => {
        const [first, ...rest] = points;
        if (!first) return;
        ctx.beginPath();
        ctx.moveTo(offsetX + first[0] * scaleX, offsetY + first[1] * scaleY);
        for (const pt of rest) ctx.lineTo(offsetX + pt[0] * scaleX, offsetY + pt[1] * scaleY);
        ctx.closePath();
      };

      // Glow is built from three blur passes at increasing radii, drawn
      // lightest-and-widest first so the layers composite additively. The
      // `filter` property applies a true gaussian blur to the fill itself,
      // not just a shadow behind it, which is what makes the edges soft.
      const glowLayers: Array<{ blur: number; fill: string }> = [
        { blur: 20, fill: "rgba(148, 215, 181, 0.15)" },  // wide halo
        { blur: 10, fill: "rgba(148, 215, 181, 0.25)" },  // medium bloom
        { blur: 3,  fill: "rgba(148, 215, 181, 0.45)" },  // tight core
      ];

      for (const stripe of liveStripes) {
        if (!notes.has(stripe.note)) continue;
        const points = scalePolygon(stripe.polygon, frame);
        if (points.length < 3) continue;

        for (const layer of glowLayers) {
          context.save();
          context.filter = `blur(${layer.blur * scaleX}px)`;
          tracePath(context, points);
          context.fillStyle = layer.fill;
          context.fill();
          context.restore();
        }
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [activeNotes, frame, liveStripes]);

  return (
    <>
      <canvas ref={canvasRef} className="realtime-overlay" aria-label="Occupied crosswalk stripe overlay" />
      <p className="visually-hidden" aria-live="polite">
        {message}
        {frame && ` Input ${frame.width} by ${frame.height}.`}
        {insideCount !== null && ` ${insideCount} people inside the crosswalk.`}
        {activeNotes.length > 0 && ` Active notes: ${activeNotes.join(", ")}.`}
      </p>
    </>
  );
}
