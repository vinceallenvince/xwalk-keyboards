import { describe, expect, it } from "vitest";

import {
  REALTIME_CALIBRATION,
  scalePoint,
  stripeForPoint,
} from "./realtime-calibration";

describe("View 5056 Realtime calibration", () => {
  it("is keyed to View 5056 and has an ordered, unique stripe keyboard", () => {
    expect(REALTIME_CALIBRATION.cameraId).toBe(5056);
    expect(REALTIME_CALIBRATION.referenceFrame).toEqual({ width: 352, height: 240 });
    expect(REALTIME_CALIBRATION.stripes.map((stripe) => stripe.stripeIndex)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    ]);
    expect(new Set(REALTIME_CALIBRATION.stripes.map((stripe) => stripe.note)).size).toBe(
      REALTIME_CALIBRATION.stripes.length
    );
  });

  it("scales points and identifies a stripe at native-frame dimensions", () => {
    expect(scalePoint([176, 120], { width: 704, height: 480 })).toEqual([352, 240]);
    expect(stripeForPoint([7, 121], { width: 352, height: 240 })?.note).toBe("C4");
    expect(stripeForPoint([321, 150], { width: 352, height: 240 })?.note).toBe("A5");
    expect(stripeForPoint([250, 180], { width: 352, height: 240 })).toBeNull();
  });
});
