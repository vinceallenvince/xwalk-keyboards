import type { CameraRecord } from "../data/cameras";

export type OrchestrationSlot = {
  cameraId: number;
  sourceCameraId: number;
  slot: number;
};

export function createInitialOrchestrationSlots(cameras: readonly CameraRecord[]): OrchestrationSlot[] {
  return cameras.map((camera, index) => ({
    cameraId: camera.cameraId,
    sourceCameraId: camera.cameraId,
    slot: index + 1,
  }));
}

export function nextActiveSlot(currentIndex: number, slotCount: number) {
  if (!Number.isInteger(currentIndex) || !Number.isInteger(slotCount) || slotCount < 1) {
    throw new Error("A non-empty orchestration batch is required");
  }
  return (currentIndex + 1) % slotCount;
}

export function nextPresentationStep(currentIndex: number, slotCount: number) {
  const nextIndex = nextActiveSlot(currentIndex, slotCount);
  return {
    loopBoundary: nextIndex === 0,
    nextIndex,
  };
}

/** A frozen performance may only begin once every slot has a fresh frame. */
export function isQueuedBatchReady(queuedSlotCount: number, slotCount: number) {
  return Number.isInteger(queuedSlotCount)
    && Number.isInteger(slotCount)
    && slotCount > 0
    && queuedSlotCount >= slotCount;
}

export function firstUnreservedFallback(
  fallbacks: readonly CameraRecord[],
  reservedSourceIds: ReadonlySet<number>
) {
  return fallbacks.find((fallback) => !reservedSourceIds.has(fallback.cameraId)) ?? null;
}
