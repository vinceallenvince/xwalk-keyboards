import { describe, expect, it } from "vitest";

import { PRIORITY_CAMERAS } from "../data/cameras";
import { hasStaticCrosswalkCalibration, staticCrosswalkPolygon } from "./orchestration-calibration";

describe("static orchestration calibration", () => {
  it("scales a curated static camera polygon to its inference frame", () => {
    expect(staticCrosswalkPolygon(3256, { width: 704, height: 480 })?.[0]).toEqual([46, 300]);
  });

  it("includes View 3230 in the calibrated priority sources", () => {
    expect(hasStaticCrosswalkCalibration(3230)).toBe(true);
    expect(staticCrosswalkPolygon(3230, { width: 352, height: 240 })?.[0]).toEqual([39, 132]);
  });

  it("covers every priority camera before snapshot inference can begin", () => {
    expect(PRIORITY_CAMERAS.every((camera) => hasStaticCrosswalkCalibration(camera.cameraId))).toBe(true);
  });
});
