import { describe, expect, it } from "vitest";

import { FALLBACK_CAMERAS, PRIORITY_CAMERAS } from "../data/cameras";
import {
  createInitialOrchestrationSlots,
  firstUnreservedFallback,
  isQueuedBatchReady,
  nextActiveSlot,
  nextPresentationStep,
} from "./orchestration-batch";

describe("orchestration batch baseline", () => {
  it("preserves the curated twelve-camera reading order", () => {
    const slots = createInitialOrchestrationSlots(PRIORITY_CAMERAS);
    expect(slots).toHaveLength(12);
    expect(slots.map((slot) => slot.cameraId)).toEqual(PRIORITY_CAMERAS.map((camera) => camera.cameraId));
    expect(slots.map((slot) => slot.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("reserves each fallback for only one logical slot and loops the active slot", () => {
    expect(firstUnreservedFallback(FALLBACK_CAMERAS, new Set([3107, 3231]))?.cameraId).toBe(3257);
    expect(nextActiveSlot(11, 12)).toBe(0);
  });

  it("does not start the performance from initial frames alone", () => {
    expect(isQueuedBatchReady(0, 12)).toBe(false);
    expect(isQueuedBatchReady(11, 12)).toBe(false);
    expect(isQueuedBatchReady(12, 12)).toBe(true);
  });

  it("identifies the only safe boundary for promoting a prepared batch", () => {
    expect(nextPresentationStep(10, 12)).toEqual({ loopBoundary: false, nextIndex: 11 });
    expect(nextPresentationStep(11, 12)).toEqual({ loopBoundary: true, nextIndex: 0 });
  });
});
