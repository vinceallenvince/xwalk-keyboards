"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import {
  countPredictionsForOutput,
  occupiedNotesFromRealtimeOutputs,
} from "@/lib/realtime-detections";
import { REALTIME_CALIBRATION, scalePolygon, type FrameSize } from "@/lib/realtime-calibration";

export type InferenceStatus = "waiting" | "starting" | "active" | "reconnecting" | "unavailable";

type RealtimeInferenceProps = {
  connectionKey: number;
  onStatusChange: (status: InferenceStatus) => void;
  sourceVideoRef: RefObject<HTMLVideoElement | null>;
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

export function RealtimeInference({
  connectionKey,
  onStatusChange,
  sourceVideoRef,
}: RealtimeInferenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioEnabledRef = useRef(false);
  const activeNotesRef = useRef(new Set<string>());
  const lastTriggeredAtRef = useRef(new Map<string, number>());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [activeNotes, setActiveNotes] = useState<string[]>([]);
  const [frame, setFrame] = useState<FrameSize | null>(null);
  const [insideCount, setInsideCount] = useState<number | null>(null);
  const [message, setMessage] = useState("Waiting for live camera");

  const clearOccupancy = () => {
    activeNotesRef.current.clear();
    setActiveNotes([]);
  };

  const toggleAudio = async () => {
    try {
      if (audioEnabledRef.current) {
        audioEnabledRef.current = false;
        clearOccupancy();
        setAudioEnabled(false);
        await audioContextRef.current?.suspend();
        return;
      }
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await context.resume();
      clearOccupancy();
      audioEnabledRef.current = true;
      setAudioEnabled(true);
    } catch {
      setMessage("Browser audio could not start");
    }
  };

  useEffect(() => () => {
    audioEnabledRef.current = false;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

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
            setInsideCount(
              countPredictionsForOutput(output, configuration.outputBindings.insideLeft) +
              countPredictionsForOutput(output, configuration.outputBindings.insideRight)
            );

            if (!audioEnabledRef.current || !audioContextRef.current) {
              activeNotesRef.current.clear();
              return;
            }
            const now = performance.now();
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
      if (connection) void connection.cleanup();
      else sourceStream?.getTracks().forEach((track) => track.stop());
    };
  }, [connectionKey, onStatusChange, sourceVideoRef]);

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

      for (const stripe of REALTIME_CALIBRATION.stripes) {
        if (!notes.has(stripe.note)) continue;
        const polygon = scalePolygon(stripe.polygon, frame);
        const [firstPoint, ...rest] = polygon;
        if (!firstPoint) continue;
        context.beginPath();
        context.moveTo(offsetX + firstPoint[0] * scaleX, offsetY + firstPoint[1] * scaleY);
        for (const point of rest) context.lineTo(offsetX + point[0] * scaleX, offsetY + point[1] * scaleY);
        context.closePath();
        context.fillStyle = "rgba(148, 215, 181, 0.42)";
        context.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [activeNotes, frame]);

  return (
    <>
      <canvas ref={canvasRef} className="realtime-overlay" aria-label="Occupied crosswalk stripe overlay" />
      <p className="visually-hidden" aria-live="polite">
        {message}
        {frame && ` Input ${frame.width} by ${frame.height}.`}
        {insideCount !== null && ` ${insideCount} people inside the crosswalk.`}
        {activeNotes.length > 0 && ` Active notes: ${activeNotes.join(", ")}.`}
      </p>
      <button type="button" className="realtime-sound-button" onClick={() => void toggleAudio()} aria-pressed={audioEnabled}>
        {audioEnabled ? "SOUND ON" : "SOUND OFF"}
      </button>
    </>
  );
}
