import { describe, expect, it } from "vitest";

import { REALTIME_CALIBRATION } from "./realtime-calibration";
import { noteForSlot } from "./realtime-scale";
import { toStripes } from "./use-calibration";

const QUAD = [[10, 120], [20, 120], [20, 130], [10, 130]];

// The scale itself is covered in realtime-scale.test.ts; these cover how a
// calibration payload is turned into stripes.
describe("toStripes", () => {
  it("derives every note from position — the agent never names notes", () => {
    const stripes = toStripes([
      { stripeIndex: 0, segment: "left", polygon: QUAD },
      { stripeIndex: 3, segment: "left", polygon: QUAD },
    ]);

    expect(stripes.map((s) => s.note)).toEqual([noteForSlot("left", 0), noteForSlot("left", 3)]);
  });

  it("ignores segments without a configured anchor", () => {
    // A camera with three crosswalks would emit "segment3"; until an anchor is
    // configured for it, its stripes are dropped rather than guessed at.
    const stripes = toStripes([
      { stripeIndex: 0, segment: "left", polygon: QUAD },
      { stripeIndex: 0, segment: "segment3", polygon: QUAD },
    ]);

    expect(stripes).toHaveLength(1);
    expect(stripes[0].segment).toBe("left");
  });

  it("drops polygons with too few points to fill", () => {
    expect(toStripes([{ stripeIndex: 0, segment: "left", polygon: [[1, 2], [3, 4]] }])).toHaveLength(0);
  });

  it("falls back to the reference when the payload has no stripes", () => {
    expect(toStripes([])).toEqual(REALTIME_CALIBRATION.stripes);
    expect(toStripes(undefined)).toEqual(REALTIME_CALIBRATION.stripes);
  });

  it("preserves the index the agent assigned", () => {
    // Gaps are meaningful — they are stripes the model could not see.
    const stripes = toStripes([
      { stripeIndex: 2, segment: "left", polygon: QUAD },
      { stripeIndex: 7, segment: "left", polygon: QUAD },
    ]);

    expect(stripes.map((s) => s.stripeIndex)).toEqual([2, 7]);
  });
});
