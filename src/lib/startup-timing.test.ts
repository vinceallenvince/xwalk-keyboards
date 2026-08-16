import { describe, expect, it } from "vitest";

import {
  createStartupTimingRecorder,
  logStartupSummary,
  type MilestoneName,
  type StartupSummary,
} from "./startup-timing";

function fakeNow() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

function recorderWithDefaults(overrides?: { sessionType?: string; connectionKey?: number; retryCount?: number; pageMountedAt?: number }) {
  const clock = fakeNow();
  const recorder = createStartupTimingRecorder({
    sessionType: (overrides?.sessionType as "initial") ?? "initial",
    connectionKey: overrides?.connectionKey ?? 0,
    retryCount: overrides?.retryCount ?? 0,
    pageMountedAt: overrides?.pageMountedAt,
    now: clock.now,
  });
  return { recorder, clock };
}

describe("createStartupTimingRecorder", () => {
  it("records milestones and computes derived durations", () => {
    const { recorder, clock } = recorderWithDefaults({ pageMountedAt: 0 });

    clock.advance(100);
    recorder.mark("attempt_start");
    clock.advance(200);
    recorder.mark("config_loaded");
    clock.advance(1500);
    recorder.mark("video_playable");
    clock.advance(8000);
    recorder.mark("gpu_ready");
    clock.advance(2000);
    recorder.mark("first_predictions");

    const s = recorder.summary();
    expect(s.timeToGpuReady).toBe(9700);
    expect(s.timeToPredictions).toBe(11700);
    expect(s.predictionLag).toBe(2000);
    expect(s.perceivedLatency).toBe(11800);
    expect(s.reachedStage).toBe("first_predictions");
    expect(s.outcome).toBe("in-progress");
  });

  it("marks are idempotent — first mark wins", () => {
    const { recorder, clock } = recorderWithDefaults();

    clock.advance(100);
    recorder.mark("attempt_start");
    clock.advance(500);
    recorder.mark("attempt_start"); // second call is ignored

    const s = recorder.summary();
    expect(s.milestones.attempt_start).toBe(100);
  });

  it("returns null durations for missing milestones", () => {
    const { recorder, clock } = recorderWithDefaults();

    clock.advance(100);
    recorder.mark("attempt_start");
    clock.advance(200);
    recorder.mark("config_loaded");

    const s = recorder.summary();
    expect(s.timeToGpuReady).toBeNull();
    expect(s.timeToPredictions).toBeNull();
    expect(s.predictionLag).toBeNull();
    expect(s.perceivedLatency).toBeNull();
    expect(s.reachedStage).toBe("config_loaded");
  });

  it("tracks the highest reached stage", () => {
    const { recorder, clock } = recorderWithDefaults();
    expect(recorder.summary().reachedStage).toBe("page_mount");

    clock.advance(50);
    recorder.mark("attempt_start");
    expect(recorder.summary().reachedStage).toBe("attempt_start");

    clock.advance(50);
    recorder.mark("gpu_ready");
    expect(recorder.summary().reachedStage).toBe("gpu_ready");
  });

  it("fail() sets outcome to failed", () => {
    const { recorder } = recorderWithDefaults();
    recorder.mark("attempt_start");
    recorder.fail();
    expect(recorder.summary().outcome).toBe("failed");
  });

  it("passes through session metadata", () => {
    const { recorder } = recorderWithDefaults({
      sessionType: "pause-continue",
      connectionKey: 3,
      retryCount: 2,
    });
    const s = recorder.summary();
    expect(s.sessionType).toBe("pause-continue");
    expect(s.connectionKey).toBe(3);
    expect(s.retryCount).toBe(2);
  });

  it("includes pageMountedAt when provided", () => {
    const { recorder } = recorderWithDefaults({ pageMountedAt: 42 });
    expect(recorder.summary().milestones.page_mount).toBe(42);
  });

  it("omits page_mount when not provided", () => {
    const { recorder } = recorderWithDefaults();
    expect(recorder.summary().milestones.page_mount).toBeUndefined();
  });
});

describe("logStartupSummary", () => {
  it("does not throw on a complete summary", () => {
    const s: StartupSummary = {
      sessionType: "initial",
      connectionKey: 0,
      retryCount: 0,
      milestones: {
        page_mount: 0,
        attempt_start: 100,
        config_loaded: 300,
        video_playable: 1800,
        gpu_ready: 9800,
        first_predictions: 11800,
      },
      timeToGpuReady: 9700,
      timeToPredictions: 11700,
      predictionLag: 2000,
      perceivedLatency: 11800,
      reachedStage: "first_predictions",
      outcome: "success",
    };
    expect(() => logStartupSummary(s)).not.toThrow();
  });

  it("does not throw on a failed summary with partial milestones", () => {
    const s: StartupSummary = {
      sessionType: "retry",
      connectionKey: 1,
      retryCount: 3,
      milestones: { attempt_start: 100, config_loaded: 300 },
      timeToGpuReady: null,
      timeToPredictions: null,
      predictionLag: null,
      perceivedLatency: null,
      reachedStage: "config_loaded",
      outcome: "failed",
    };
    expect(() => logStartupSummary(s)).not.toThrow();
  });
});
