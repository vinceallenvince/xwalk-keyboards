"use client";

import { useEffect, useRef, useState } from "react";

import { FALLBACK_CAMERAS, PRIORITY_CAMERAS, type CameraRecord } from "@/data/cameras";
import { requestCrosswalkScore } from "@/lib/crosswalk-agent-client";
import { createCrosswalkScorePlayer, type CrosswalkScorePlayer } from "@/lib/crosswalk-audio";
import {
  createInitialOrchestrationSlots,
  firstUnreservedFallback,
  isQueuedBatchReady,
  nextActiveSlot,
  type OrchestrationSlot,
} from "@/lib/orchestration-batch";
import { createCrosswalkComposite } from "@/lib/crosswalk-composite";
import { createCrosswalkBatchManifest, type CrosswalkScore } from "@/lib/crosswalk-score";

const PRESENTATION_INTERVAL_MS = 5_000;
const POLL_INTERVAL_MS = 5_000;

type BatchPhase = "loading" | "queuing" | "stitching" | "scoring" | "playing" | "score-unavailable" | "unavailable";

type LoadedSlot = OrchestrationSlot & {
  imageUrl: string;
  insideCount?: number;
  isFallback: boolean;
  outsideCount?: number;
  predictionCount?: number;
};

type SnapshotResponse =
  | { kind: "available"; image: Blob; imageHash: string; sourceCamera: CameraRecord }
  | { kind: "unavailable" };

type InferenceCandidate = {
  image: Blob;
  imageHash: string;
  slot: LoadedSlot;
  version: number;
};

type SnapshotInferenceResult =
  | { kind: "complete"; imageUrl: string; insideCount: number; outsideCount: number; predictionCount: number }
  | { kind: "uncalibrated" | "unconfigured" | "failed" };

function fingerprintImage(image: Blob) {
  return image.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let hash = 5381;
    for (const byte of bytes) hash = (hash * 33) ^ byte;
    return `${bytes.length}-${hash >>> 0}`;
  });
}

async function requestSnapshot(camera: CameraRecord, signal: AbortSignal): Promise<SnapshotResponse> {
  try {
    const response = await fetch(`/api/snapshot/${camera.cameraId}`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok || response.headers.get("X-Camera-Status") !== "active") {
      return { kind: "unavailable" };
    }
    const image = await response.blob();
    if (!image.type.startsWith("image/")) return { kind: "unavailable" };
    return {
      kind: "available",
      image,
      imageHash: await fingerprintImage(image),
      sourceCamera: camera,
    };
  } catch (error) {
    // Route cleanup deliberately aborts outstanding snapshot requests. It is
    // not a camera failure and must not escape as an unhandled rejection.
    if (error instanceof DOMException && error.name === "AbortError") return { kind: "unavailable" };
    return { kind: "unavailable" };
  }
}

async function inferChangedSnapshot(candidate: InferenceCandidate, signal: AbortSignal): Promise<SnapshotInferenceResult> {
  try {
    const formData = new FormData();
    formData.set("cameraId", String(candidate.slot.sourceCameraId));
    formData.set("image", candidate.image, `camera-${candidate.slot.sourceCameraId}.jpg`);
    const response = await fetch("/api/roboflow/image", {
      body: formData,
      cache: "no-store",
      method: "POST",
      signal,
    });
    if (response.ok) {
      const result = await response.json() as Partial<Extract<SnapshotInferenceResult, { kind: "complete" }>>;
      if (
        typeof result.imageUrl !== "string" ||
        typeof result.insideCount !== "number" ||
        typeof result.outsideCount !== "number" ||
        typeof result.predictionCount !== "number"
      ) return { kind: "failed" };
      return {
        kind: "complete",
        imageUrl: result.imageUrl,
        insideCount: result.insideCount,
        outsideCount: result.outsideCount,
        predictionCount: result.predictionCount,
      };
    }
    if (response.status === 422) return { kind: "uncalibrated" };
    if (response.status === 503) return { kind: "unconfigured" };
    return { kind: "failed" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { kind: "failed" };
    return { kind: "failed" };
  }
}

export function OrchestrationGrid() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedSlots, setLoadedSlots] = useState<LoadedSlot[]>([]);
  const [phase, setPhase] = useState<BatchPhase>("loading");
  const [unavailableSlots, setUnavailableSlots] = useState<number[]>([]);
  const [queuedSlotCount, setQueuedSlotCount] = useState(0);
  const [inferenceWorkers, setInferenceWorkers] = useState(0);
  const [inferenceBlocked, setInferenceBlocked] = useState<"calibration" | "configuration" | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioTransportActive, setAudioTransportActive] = useState(false);
  const [activeScore, setActiveScore] = useState<CrosswalkScore | null>(null);
  const [scoreTitle, setScoreTitle] = useState<string | null>(null);
  const audioEnabledRef = useRef(false);
  const objectUrlsRef = useRef<string[]>([]);
  const queuedFramesRef = useRef<LoadedSlot[]>([]);
  const activeIndexRef = useRef(0);
  const scoreRef = useRef<CrosswalkScore | null>(null);
  const scorePlayerRef = useRef<CrosswalkScorePlayer | null>(null);

  const applyScoreEvent = (event: CrosswalkScore["events"][number]) => {
    const nextQueuedFrame = queuedFramesRef.current[event.index];
    if (nextQueuedFrame) {
      setLoadedSlots((current) => current.map((slot) => (
        slot.slot === nextQueuedFrame.slot ? nextQueuedFrame : slot
      )));
    }
    activeIndexRef.current = event.index;
    setActiveIndex(event.index);
  };

  const startAudioPerformance = async () => {
    const score = scoreRef.current;
    if (!score || !audioEnabledRef.current) return;
    const player = scorePlayerRef.current ?? await createCrosswalkScorePlayer();
    scorePlayerRef.current = player;
    await player.enable();
    if (!audioEnabledRef.current || scoreRef.current?.batchId !== score.batchId) return;
    setAudioTransportActive(true);
    await player.play(score, applyScoreEvent, () => {
      if (audioEnabledRef.current && scoreRef.current?.batchId === score.batchId) void startAudioPerformance();
    });
  };

  const toggleAudio = async () => {
    if (audioEnabledRef.current) {
      audioEnabledRef.current = false;
      scorePlayerRef.current?.stop();
      setAudioEnabled(false);
      setAudioTransportActive(false);
      return;
    }
    if (!scoreRef.current) return;
    audioEnabledRef.current = true;
    setAudioEnabled(true);
    try {
      await startAudioPerformance();
    } catch {
      audioEnabledRef.current = false;
      scorePlayerRef.current?.stop();
      setAudioEnabled(false);
      setAudioTransportActive(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    const initialSlots = createInitialOrchestrationSlots(PRIORITY_CAMERAS);
    const camerasById = new Map([...PRIORITY_CAMERAS, ...FALLBACK_CAMERAS].map((camera) => [camera.cameraId, camera]));
    const initialHashes = new Map<number, string>();
    const resolvedBySlot = new Map<number, LoadedSlot>();
    const queuedBySlot = new Map<number, LoadedSlot>();
    const candidateVersions = new Map<number, number>();
    const pendingInference = new Map<number, InferenceCandidate>();
    let polling = false;
    let batchFrozen = false;
    let batchSequence = 0;
    let activeInferenceWorkers = 0;
    let staticInferenceConfigured = true;

    const trackObjectUrl = (image: Blob) => {
      const imageUrl = URL.createObjectURL(image);
      objectUrlsRef.current.push(imageUrl);
      return imageUrl;
    };

    const beginPerformanceIfReady = () => {
      setQueuedSlotCount(queuedBySlot.size);
      if (!isQueuedBatchReady(queuedBySlot.size, initialSlots.length)) return;

      batchFrozen = true;
      const frozenBatch = initialSlots.map((slot) => queuedBySlot.get(slot.slot)).filter((slot): slot is LoadedSlot => Boolean(slot));
      batchSequence += 1;
      const manifest = createCrosswalkBatchManifest(
        `batch-${new Date().toISOString().replace(/[^0-9]/g, "")}-${batchSequence}`,
        new Date().toISOString(),
        frozenBatch.map((slot) => ({
          cameraId: slot.cameraId,
          predictionCount: slot.predictionCount ?? null,
          sourceCameraId: slot.sourceCameraId,
          sourceTimestamp: null,
        }))
      );
      setPhase("stitching");

      void (async () => {
        try {
          const composite = await createCrosswalkComposite(frozenBatch);
          if (abortController.signal.aborted) return;
          setPhase("scoring");
          const score = await requestCrosswalkScore(manifest, composite);
          if (abortController.signal.aborted) return;
          const firstQueuedFrame = frozenBatch[0];
          queuedFramesRef.current = frozenBatch;
          activeIndexRef.current = 0;
          setActiveIndex(0);
          scoreRef.current = score;
          setActiveScore(score);
          setScoreTitle(score.musicDirection.title);
          // Preserve the initial grid until its matching camera performs. This
          // makes the incoming queued image visible at the exact active turn,
          // rather than replacing all twelve views at once.
          if (firstQueuedFrame) {
            setLoadedSlots((current) => current.map((slot) => (
              slot.slot === firstQueuedFrame.slot ? firstQueuedFrame : slot
            )));
          }
          setPhase("playing");
        } catch {
          if (!abortController.signal.aborted) setPhase("score-unavailable");
        }
      })();
    };

    const drainInferenceQueue = () => {
      while (!abortController.signal.aborted && staticInferenceConfigured && activeInferenceWorkers < 2 && pendingInference.size > 0) {
        const candidate = pendingInference.values().next().value as InferenceCandidate;
        pendingInference.delete(candidate.slot.slot);
        activeInferenceWorkers += 1;
        setInferenceWorkers(activeInferenceWorkers);

        void inferChangedSnapshot(candidate, abortController.signal).then((result) => {
          if (abortController.signal.aborted) return;
          if (result.kind === "unconfigured") {
            staticInferenceConfigured = false;
            pendingInference.clear();
            setInferenceBlocked("configuration");
            return;
          }
          if (result.kind === "uncalibrated") {
            setInferenceBlocked("calibration");
            return;
          }
          if (result.kind !== "complete" || candidateVersions.get(candidate.slot.slot) !== candidate.version || queuedBySlot.has(candidate.slot.slot)) return;

          queuedBySlot.set(candidate.slot.slot, {
            ...candidate.slot,
            imageUrl: result.imageUrl,
            insideCount: result.insideCount,
            outsideCount: result.outsideCount,
            predictionCount: result.predictionCount,
          });
          beginPerformanceIfReady();
        }).finally(() => {
          activeInferenceWorkers -= 1;
          setInferenceWorkers(activeInferenceWorkers);
          drainInferenceQueue();
        });
      }
    };

    const enqueueInference = (slot: LoadedSlot, image: Blob, imageHash: string) => {
      if (!staticInferenceConfigured || queuedBySlot.has(slot.slot)) return;
      const version = (candidateVersions.get(slot.slot) ?? 0) + 1;
      candidateVersions.set(slot.slot, version);
      pendingInference.set(slot.slot, { image, imageHash, slot, version });
      drainInferenceQueue();
    };

    const pollForQueuedFrames = async () => {
      if (polling || batchFrozen || abortController.signal.aborted) return;
      polling = true;

      try {
        const currentSlots = [...resolvedBySlot.values()];
        const updates = await Promise.all(currentSlots.map(async (slot) => {
          const sourceCamera = camerasById.get(slot.sourceCameraId);
          if (!sourceCamera) return { slot, result: { kind: "unavailable" } as SnapshotResponse };
          return { slot, result: await requestSnapshot(sourceCamera, abortController.signal) };
        }));

        if (abortController.signal.aborted) return;
        for (const { slot, result } of updates) {
          if (result.kind !== "available") continue;
          if (initialHashes.get(slot.slot) === result.imageHash) continue;

          // A changed image becomes an inference candidate. The worker queue
          // retains at most two serverless requests and a newer source frame
          // supersedes any pending candidate for this logical camera.
          initialHashes.set(slot.slot, result.imageHash);
          enqueueInference(slot, result.image, result.imageHash);
        }
      } finally {
        polling = false;
      }
    };

    const loadBatch = async () => {
      const primaryResults = await Promise.all(initialSlots.map(async (slot) => {
        const result = await requestSnapshot(PRIORITY_CAMERAS[slot.slot - 1], abortController.signal);
        if (result.kind === "available" && !abortController.signal.aborted) {
          const loadedSlot = {
            ...slot,
            imageUrl: trackObjectUrl(result.image),
            isFallback: false,
          };
          setLoadedSlots((current) => [...current.filter((candidate) => candidate.slot !== slot.slot), loadedSlot]);
          return { slot, result, loadedSlot };
        }
        return { slot, result, loadedSlot: null };
      }));
      if (abortController.signal.aborted) return;

      const reservedFallbackIds = new Set<number>();
      const unavailable: number[] = [];
      const resolved: LoadedSlot[] = [];
      for (const { slot, result, loadedSlot } of primaryResults) {
        if (result.kind === "available") {
          if (!loadedSlot) continue;
          resolved.push(loadedSlot);
          initialHashes.set(slot.slot, result.imageHash);
          continue;
        }

        let fallback = firstUnreservedFallback(FALLBACK_CAMERAS, reservedFallbackIds);
        let fallbackResult: SnapshotResponse | null = null;
        while (fallback) {
          const candidate = await requestSnapshot(fallback, abortController.signal);
          if (candidate.kind === "available") {
            fallbackResult = candidate;
            reservedFallbackIds.add(fallback.cameraId);
            break;
          }
          reservedFallbackIds.add(fallback.cameraId);
          fallback = firstUnreservedFallback(FALLBACK_CAMERAS, reservedFallbackIds);
        }

        if (fallbackResult?.kind === "available") {
          const loadedSlot = {
            ...slot,
            imageUrl: trackObjectUrl(fallbackResult.image),
            isFallback: true,
            sourceCameraId: fallbackResult.sourceCamera.cameraId,
          };
          resolved.push(loadedSlot);
          initialHashes.set(slot.slot, fallbackResult.imageHash);
        } else {
          unavailable.push(slot.slot);
        }
      }

      if (abortController.signal.aborted) {
        resolved.forEach((slot) => URL.revokeObjectURL(slot.imageUrl));
        return;
      }

      setLoadedSlots(resolved);
      setUnavailableSlots(unavailable);
      if (unavailable.length > 0 || resolved.length !== initialSlots.length) {
        setPhase("unavailable");
        return;
      }

      resolved.forEach((slot) => resolvedBySlot.set(slot.slot, slot));
      setPhase("queuing");
      window.setTimeout(() => void pollForQueuedFrames(), POLL_INTERVAL_MS);
    };

    void loadBatch();
    const pollInterval = window.setInterval(() => void pollForQueuedFrames(), POLL_INTERVAL_MS);
    return () => {
      abortController.abort();
      window.clearInterval(pollInterval);
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      queuedFramesRef.current = [];
      audioEnabledRef.current = false;
      scorePlayerRef.current?.dispose();
      scorePlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing" || audioTransportActive || loadedSlots.length !== PRIORITY_CAMERAS.length) return;
    const interval = window.setInterval(() => {
      const nextIndex = nextActiveSlot(activeIndexRef.current, loadedSlots.length);
      const nextQueuedFrame = queuedFramesRef.current[nextIndex];
      if (nextQueuedFrame) {
        setLoadedSlots((current) => current.map((slot) => (
          slot.slot === nextQueuedFrame.slot ? nextQueuedFrame : slot
        )));
      }
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    }, PRESENTATION_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [audioTransportActive, loadedSlots.length, phase]);

  const status = phase === "loading"
    ? `PREPARING INITIAL VIEWS // ${loadedSlots.length}/12 SOURCES READY`
    : phase === "queuing"
      ? inferenceBlocked === "configuration"
        ? "STATIC INFERENCE NOT CONFIGURED"
        : inferenceBlocked === "calibration"
          ? "WAITING FOR STATIC CAMERA CALIBRATION"
          : `PREPARING CAMERA QUEUES // ${queuedSlotCount}/12 INFERENCE READY · ${inferenceWorkers}/2 WORKERS`
    : phase === "playing"
      ? `${scoreTitle ?? "CONDUCTOR SCORE"} // CAMERA ${String(activeIndex + 1).padStart(2, "0")} OF 12`
      : phase === "stitching"
        ? "STITCHING FROZEN 12-CAMERA BATCH"
        : phase === "scoring"
          ? "CONDUCTOR ANALYZING FROZEN BATCH"
          : phase === "score-unavailable"
            ? "CONDUCTOR SCORE UNAVAILABLE"
      : `WAITING FOR USABLE SOURCES // SLOTS ${unavailableSlots.map((slot) => String(slot).padStart(2, "0")).join(", ")}`;

  return (
    <section className="orchestration-grid" aria-label="Orchestration camera performance">
      <div className={`orchestration-tiles orchestration-tiles--${phase}`}>
        {createInitialOrchestrationSlots(PRIORITY_CAMERAS).map((slot, index) => {
          const loaded = loadedSlots.find((candidate) => candidate.slot === slot.slot);
          const isActive = phase === "playing" && index === activeIndex;
          return (
            <article className={`orchestration-tile${isActive ? " orchestration-tile--active" : ""}`} key={slot.cameraId}>
              {loaded ? (
                // Snapshot blobs are transient, same-origin operational media. They cannot use Next's remote image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`511NY snapshot for Camera ${slot.slot}`} src={loaded.imageUrl} />
              ) : (
                <div className="orchestration-tile__placeholder">{unavailableSlots.includes(slot.slot) ? "SOURCE UNAVAILABLE" : "LOADING SNAPSHOT"}</div>
              )}
            </article>
          );
        })}
      </div>
      <div className="orchestration-statusbar">
        <span><i className={`status-dot status-dot--${phase === "playing" ? "live" : phase === "unavailable" ? "unavailable" : "reconnecting"}`} />{status}</span>
        <span className="orchestration-controls">
          {phase === "queuing" ? "POLLING + SERVER-SIDE INFERENCE" : phase === "stitching" || phase === "scoring" ? "SCORE PREPARATION" : phase === "playing" ? "FROZEN SCORED BATCH" : "INITIAL SNAPSHOT BATCH"}
          <button className="orchestration-sound-button" type="button" disabled={!activeScore} aria-pressed={audioEnabled} onClick={() => void toggleAudio()}>
            {activeScore ? audioEnabled ? "SOUND OFF" : "SOUND ON" : "SOUND WAITING"}
          </button>
        </span>
      </div>
    </section>
  );
}
