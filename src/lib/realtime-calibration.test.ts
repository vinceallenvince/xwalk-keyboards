import { describe, expect, it } from "vitest";

import {
  REALTIME_CALIBRATION,
  scalePoint,
  stripeForPoint,
} from "./realtime-calibration";
import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";
import { noteForSlot } from "./realtime-scale";

describe("View 5056 Realtime calibration", () => {
  it("is keyed to View 5056 and has an ordered, unique stripe keyboard", () => {
    expect(REALTIME_CALIBRATION.cameraId).toBe(5056);
    expect(REALTIME_CALIBRATION.referenceFrame).toEqual({ width: 352, height: 240 });
    // Indexes follow the agent convention: 0-based, per segment.
    const left = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "left");
    const right = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "right");
    expect(left.map((s) => s.stripeIndex)).toEqual([...Array(18).keys()]);
    expect(right.map((s) => s.stripeIndex)).toEqual([...Array(7).keys()]);
    expect(new Set(REALTIME_CALIBRATION.stripes.map((stripe) => stripe.note)).size).toBe(
      REALTIME_CALIBRATION.stripes.length
    );
  });

  it("agrees with the generated scale on every stripe", () => {
    // The reference's explicit notes and the anchor-derived scale must never
    // diverge — live calibrations carry no notes, so noteForSlot is the only
    // source of truth for them, and a stripe must sound the same whichever
    // calibration source is active.
    for (const stripe of REALTIME_CALIBRATION.stripes) {
      expect(noteForSlot(DEFAULT_LIVE_CAMERA.segmentAnchors, stripe.segment, stripe.stripeIndex)).toBe(stripe.note);
    }
  });

  it("scales points and identifies a stripe at native-frame dimensions", () => {
    expect(scalePoint([176, 120], REALTIME_CALIBRATION.referenceFrame, { width: 704, height: 480 })).toEqual([352, 240]);
    expect(stripeForPoint([7, 121], { width: 352, height: 240 })?.note).toBe("C4");
    expect(stripeForPoint([321, 150], { width: 352, height: 240 })?.note).toBe("A5");
    expect(stripeForPoint([250, 180], { width: 352, height: 240 })).toBeNull();
  });
});
