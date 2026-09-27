"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pickRecordingMimeType, recordingFileName } from "@/lib/tab-recording";

export type RecorderPhase = "idle" | "requesting" | "recording";

// Chrome-only members of the getDisplayMedia options that lib.dom does not
// type yet: offer this tab first, and allow it to be chosen at all.
type TabCaptureOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
};

type RecordingSession = { recorder: MediaRecorder; stream: MediaStream };

// Well above Chrome's default so the stripe glow and small pedestrians survive
// encoding; a take is a few minutes, so file size is not a concern.
const VIDEO_BITS_PER_SECOND = 8_000_000;

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking synchronously can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Records the current tab — video and the audio it plays — into a single file
 * the operator downloads. The Realtime piano is Web Audio, which the macOS
 * screen recorder cannot hear, so this is how demo takes get their sound.
 *
 * A recording in progress when the component unmounts is discarded: the
 * tracks are stopped and nothing is downloaded.
 */
export function useTabRecorder(cameraId: number) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  // Bumped on unmount so late share-prompt answers and recorder callbacks
  // cannot touch state or trigger a download.
  const generationRef = useRef(0);

  const start = useCallback(async () => {
    if (sessionRef.current) return;
    const generation = generationRef.current;
    setMessage(null);
    setPhase("requesting");

    let stream: MediaStream;
    try {
      const options: TabCaptureOptions = {
        video: { frameRate: 30 },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      };
      stream = await navigator.mediaDevices.getDisplayMedia(options);
    } catch {
      // The operator dismissed the prompt or the browser refused.
      if (generation === generationRef.current) setPhase("idle");
      return;
    }
    if (generation !== generationRef.current) {
      stopTracks(stream);
      return;
    }
    // The audio checkbox in Chrome's prompt is easy to miss, and a silent take
    // defeats the purpose — refuse rather than record video alone.
    if (stream.getAudioTracks().length === 0) {
      stopTracks(stream);
      setPhase("idle");
      setMessage("NO TAB AUDIO: SHARE THE TAB AGAIN WITH ITS AUDIO ON");
      return;
    }

    const mimeType = pickRecordingMimeType((type) => MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      });
    } catch {
      stopTracks(stream);
      setPhase("idle");
      setMessage("RECORDING COULD NOT START");
      return;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stopTracks(stream);
      if (generation !== generationRef.current) return;
      sessionRef.current = null;
      setPhase("idle");
      setStartedAt(null);
      const type = recorder.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size > 0) download(blob, recordingFileName(cameraId, new Date(), type));
    };
    // The browser's own "Stop sharing" control ends the video track.
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (recorder.state !== "inactive") recorder.stop();
    });

    sessionRef.current = { recorder, stream };
    // A timeslice keeps long takes in bounded chunks instead of one buffer.
    recorder.start(1_000);
    const startTime = Date.now();
    setStartedAt(startTime);
    setNow(startTime);
    setPhase("recording");
  }, [cameraId]);

  const stop = useCallback(() => {
    const recorder = sessionRef.current?.recorder;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => () => {
    generationRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    if (session.recorder.state !== "inactive") session.recorder.stop();
    stopTracks(session.stream);
  }, []);

  const elapsedMs = startedAt == null ? 0 : now - startedAt;
  return { phase, elapsedMs, message, start, stop };
}
