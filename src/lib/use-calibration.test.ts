import { describe, expect, it } from "vitest";

import { REALTIME_CALIBRATION } from "./realtime-calibration";
import { noteForSlot, toStripes } from "./use-calibration";

const LEFT_SCALE = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "left");
const RIGHT_SCALE = REALTIME_CALIBRATION.stripes.filter((s) => s.segment === "right");

const QUAD = [[10, 120], [20, 120], [20, 130], [10, 130]];

describe("noteForSlot", () => {
  it("reads the scale in crosswalk order", () => {
    expect(noteForSlot("left", 0)).toBe(LEFT_SCALE[0].note);
    expect(noteForSlot("left", 5)).toBe(LEFT_SCALE[5].note);
    expect(noteForSlot("right", 0)).toBe(RIGHT_SCALE[0].note);
  });

  it("holds the top note past the end of the scale", () => {
    const last = LEFT_SCALE[LEFT_SCALE.length - 1].note;
    expect(noteForSlot("left", LEFT_SCALE.length)).toBe(last);
    expect(noteForSlot("left", 999)).toBe(last);
  });

  it("clamps negative indexes to the bottom note", () => {
    expect(noteForSlot("left", -3)).toBe(LEFT_SCALE[0].note);
  });
});

describe("toStripes", () => {
  it("derives notes from position when the agent omits them", () => {
    const stripes = toStripes([
      { stripeIndex: 0, segment: "left", polygon: QUAD },
      { stripeIndex: 3, segment: "left", polygon: QUAD },
    ]);

    expect(stripes.map((s) => s.note)).toEqual([LEFT_SCALE[0].note, LEFT_SCALE[3].note]);
  });

  it("keeps notes from calibrations published before the split", () => {
    const stripes = toStripes([
      { stripeIndex: 0, segment: "left", note: "Bb3", visible: true, polygon: QUAD },
    ]);

    expect(stripes[0].note).toBe("Bb3");
  });

  it("treats an absent visible flag as visible", () => {
    // Newer calibrations only carry stripes that were actually detected.
    expect(toStripes([{ stripeIndex: 0, segment: "left", polygon: QUAD }])).toHaveLength(1);
  });

  it("still drops stripes explicitly marked not visible", () => {
    const stripes = toStripes([
      { stripeIndex: 0, segment: "left", visible: false, polygon: QUAD },
      { stripeIndex: 1, segment: "left", visible: true, polygon: QUAD },
    ]);

    expect(stripes).toHaveLength(1);
    expect(stripes[0].stripeIndex).toBe(1);
  });

  it("ignores segments the app cannot render", () => {
    // A camera with three crosswalks would emit "segment3".
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
