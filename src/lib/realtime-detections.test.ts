import { describe, expect, it } from "vitest";

import {
  countPredictionsForOutput,
  lowerBodyPoint,
  occupiedStripesFromAllDetections,
} from "./realtime-detections";
import { REALTIME_CALIBRATION } from "./realtime-calibration";

describe("Realtime prediction mapping", () => {
  const calibration = {
    stripes: REALTIME_CALIBRATION.stripes,
    boundaries: REALTIME_CALIBRATION.boundaries,
  };

  it("classifies detections client-side using live calibration", () => {
    const output = {
      all: { predictions: [
        { x: 72, y: 115, width: 8, height: 10 },   // inside left crosswalk
        { x: 320, y: 138, width: 6, height: 12 },   // inside right crosswalk
        { x: 250, y: 180, width: 12, height: 12 },   // outside both crosswalks
      ]},
    };
    const occupied = occupiedStripesFromAllDetections(
      output, "all", { width: 352, height: 240 }, calibration,
    );
    // Foot-point (72, 120) falls on F#4 with direct polygon hit testing.
    expect(occupied.map((s) => s.note)).toEqual(["F#4", "Bb5"]);
    // Each occupied stripe is identified independently of what it plays.
    expect(occupied.map((s) => s.key)).toEqual(["left:7", "right:23"]);
    expect(countPredictionsForOutput(output, "all")).toBe(3);
  });

  it("uses a detection foot point", () => {
    expect(lowerBodyPoint({ x: 10, y: 20, width: 4, height: 8 })).toEqual([10, 24]);
  });
});
