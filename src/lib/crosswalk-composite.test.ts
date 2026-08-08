import { describe, expect, it } from "vitest";

import {
  COMPOSITE_CELL_HEIGHT,
  COMPOSITE_CELL_WIDTH,
  COMPOSITE_HEIGHT,
  COMPOSITE_WIDTH,
  getCameraImageSourceCrop,
  getCompositeCellLayout,
} from "./crosswalk-composite";

describe("crosswalk composite layout", () => {
  it("lays twelve frames in four columns and three rows", () => {
    expect(getCompositeCellLayout(0)).toMatchObject({ x: 0, y: 0 });
    expect(getCompositeCellLayout(11)).toMatchObject({ x: COMPOSITE_CELL_WIDTH * 3, y: COMPOSITE_CELL_HEIGHT * 2 });
    expect(COMPOSITE_WIDTH).toBe(COMPOSITE_CELL_WIDTH * 4);
    expect(COMPOSITE_HEIGHT).toBe(COMPOSITE_CELL_HEIGHT * 3);
  });

  it("crops the baked-in 511NY header without stretching the image", () => {
    const crop = getCameraImageSourceCrop(352, 240, 396, 269);
    expect(crop.y).toBe(20);
    expect(crop.width / crop.height).toBeCloseTo(396 / 269);
  });
});
