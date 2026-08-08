import { describe, expect, it } from "vitest";

import {
  countPredictionsForOutput,
  lowerBodyPoint,
  occupiedNotesFromRealtimeOutputs,
} from "./realtime-detections";

describe("Realtime prediction mapping", () => {
  it("maps only inside outputs to their calibrated stripe notes", () => {
    const output = {
      insideLeft: { predictions: [{ x: 72, y: 115, width: 8, height: 10 }] },
      insideRight: { predictions: [{ x: 320, y: 138, width: 6, height: 12 }] },
      outside: { predictions: [{ x: 250, y: 180, width: 12, height: 12 }] },
    };
    expect(occupiedNotesFromRealtimeOutputs(output, {
      insideLeft: "insideLeft", insideRight: "insideRight",
    }, { width: 352, height: 240 })).toEqual(["G4", "Bb5"]);
    expect(countPredictionsForOutput(output, "outside")).toBe(1);
  });

  it("uses a detection foot point", () => {
    expect(lowerBodyPoint({ x: 10, y: 20, width: 4, height: 8 })).toEqual([10, 24]);
  });
});
