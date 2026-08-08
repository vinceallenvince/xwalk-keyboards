import { describe, expect, it } from "vitest";

import { adaptAndValidateCrosswalkScore, createCrosswalkBatchManifest } from "./crosswalk-score";

const manifest = createCrosswalkBatchManifest("batch-test", "2026-08-07T19:00:00.000Z", Array.from({ length: 12 }, (_, index) => ({
  cameraId: 3200 + index,
  predictionCount: index,
  sourceCameraId: 3200 + index,
  sourceTimestamp: null,
})));

function scoreFixture() {
  return {
    schemaVersion: "3",
    batchId: manifest.batchId,
    intervalSeconds: 5,
    durationSeconds: 60,
    source: "agent",
    model: "gemini-2.5-flash",
    musicDirection: { title: "Glass Avenue", description: "A restrained score.", masterReverb: .22 },
    voices: [{ id: "glassy-fm", instrument: "fmPoly", preset: "glass", effects: [] }],
    events: manifest.cameras.map((camera, index) => ({
      index,
      intervalStartSeconds: camera.intervalStartSeconds,
      cameraId: camera.cameraId,
      gridPosition: camera.gridPosition,
      occupancy: index === 0 ? "occupied" : "none",
      occupiedStripeIndexes: index === 0 ? [0, 3] : [],
      confidence: .9,
      voiceId: "glassy-fm",
      gesture: index === 0 ? "ascending" : "rest",
      durationSeconds: 1.8,
      velocity: .65,
      pan: -.75 + (index % 4) * .5,
      octaveShift: 0,
      arpeggioSpacingSeconds: .18,
      audioDescription: index === 0 ? "Glassy figure." : "Rest.",
      visual: { presentation: "grid", rationale: "Keep the full ensemble visible." },
    })),
  };
}

describe("crosswalk score contract", () => {
  it("accepts a complete schema-v3 score for its exact frozen batch", () => {
    const score = adaptAndValidateCrosswalkScore(scoreFixture(), manifest);
    expect(score?.schemaVersion).toBe("3");
    expect(score?.events[0].notes).toEqual(["C4", "F4"]);
  });

  it("rejects a score without the required visual direction", () => {
    const score = scoreFixture();
    delete (score.events[0] as { visual?: unknown }).visual;
    expect(adaptAndValidateCrosswalkScore(score, manifest)).toBeNull();
  });
});
