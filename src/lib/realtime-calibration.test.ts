import { describe, expect, it } from "vitest";

import {
  REALTIME_CALIBRATION,
  scalePoint,
  stripeForPoint,
} from "./realtime-calibration";
import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";
import { noteForOrdinal } from "./realtime-scale";

describe("View 5056 Realtime calibration", () => {
  it("is keyed to View 5056 and has an ordered, unique stripe keyboard", () => {
    expect(REALTIME_CALIBRATION.cameraId).toBe(5056);
    expect(REALTIME_CALIBRATION.referenceFrame).toEqual({ width: 352, height: 240 });
    // Indexes follow the agent convention: 0-based, per segment.
    const first = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "segment0");
    const second = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "segment1");
    expect(first.map((s) => s.stripeIndex)).toEqual([...Array(18).keys()]);
    expect(second.map((s) => s.stripeIndex)).toEqual([...Array(7).keys()]);
    expect(new Set(REALTIME_CALIBRATION.stripes.map((stripe) => stripe.note)).size).toBe(
      REALTIME_CALIBRATION.stripes.length
    );
  });

  it("agrees with the generated scale on every stripe", () => {
    // The reference's explicit notes and the generated scale must never
    // diverge — live calibrations carry no notes, so the generator is the only
    // source of truth for them, and a stripe must sound the same whichever
    // calibration source is active. The reference is stored in crossing order,
    // so its position in the array is its global ordinal.
    REALTIME_CALIBRATION.stripes.forEach((stripe, ordinal) => {
      expect(noteForOrdinal(DEFAULT_LIVE_CAMERA.baseAnchor, ordinal)).toBe(stripe.note);
    });
  });

  it("scales points and identifies a stripe at native-frame dimensions", () => {
    expect(scalePoint([176, 120], REALTIME_CALIBRATION.referenceFrame, { width: 704, height: 480 })).toEqual([352, 240]);
    expect(stripeForPoint([7, 121], { width: 352, height: 240 })?.note).toBe("C4");
    expect(stripeForPoint([321, 150], { width: 352, height: 240 })?.note).toBe("A5");
    expect(stripeForPoint([250, 180], { width: 352, height: 240 })).toBeNull();
  });
});
