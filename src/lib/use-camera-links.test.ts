import { describe, expect, it } from "vitest";

import { selectableCameraLinks, type CameraLink } from "./use-camera-links";

const camera = (cameraId: number, status: string, crosswalkRank = 3): CameraLink => ({
  cameraId,
  status,
  crosswalkRank,
});

describe("selectable camera links", () => {
  it("excludes feed-down and no-crosswalk cameras when usable feeds exist", () => {
    expect(selectableCameraLinks([
      camera(90014, "feed_down", 1),
      camera(5059, "no_crosswalk", 1),
      camera(5056, "degraded", 2),
      camera(5072, "ok", 1),
    ])).toEqual([
      camera(5072, "ok", 1),
      camera(5056, "degraded", 2),
    ]);
  });

  it("keeps rotated cameras only when every available feed is rotated", () => {
    expect(selectableCameraLinks([
      camera(5056, "no_crosswalk", 2),
      camera(5059, "no_crosswalk", 1),
      camera(90014, "feed_down", 1),
    ])).toEqual([
      camera(5059, "no_crosswalk", 1),
      camera(5056, "no_crosswalk", 2),
    ]);
  });

  it("returns no links when every feed is down", () => {
    expect(selectableCameraLinks([
      camera(5056, "feed_down"),
      camera(90014, "feed_down"),
    ])).toEqual([]);
  });
});
