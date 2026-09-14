import { describe, expect, it } from "vitest";

import carlaFallback from "../../public/calibration-fallback-90014.json";
import { liveCameraById } from "@/data/cameras";
import { isPointInPolygon, type Point } from "./realtime-calibration";
import { occupiedStripesFromAllDetections } from "./realtime-detections";
import { midiForNote, stripeKey } from "./realtime-scale";
import { toBoundaries, toStripes } from "./use-calibration";

const CAMERA = liveCameraById(90014)!;
const RAW_STRIPES = carlaFallback.stripes;
const STRIPES = toStripes(CAMERA, RAW_STRIPES);
const BOUNDARIES = toBoundaries({ status: "degraded" }, STRIPES);
const FRAME = carlaFallback.referenceFrame;

function centroid(polygon: readonly (readonly number[])[]): Point {
  return [
    polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
    polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
  ];
}

function detectionAt([x, y]: Point) {
  return { all: { predictions: [{ x, y, width: 0, height: 0 }] } };
}

describe("CARLA camera 90014 calibration", () => {
  it("represents all 20 visible stripes in left-to-right order across two runs", () => {
    expect(FRAME).toEqual({ width: 352, height: 240 });
    expect(RAW_STRIPES).toHaveLength(20);

    for (const [segment, expectedIndexes] of [
      ["segment0", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      ["segment1", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
    ] as const) {
      expect(RAW_STRIPES.filter((stripe) => stripe.segment === segment).map((stripe) => stripe.stripeIndex))
        .toEqual(expectedIndexes);
    }

    const centroidXs = RAW_STRIPES.map((stripe) => centroid(stripe.polygon)[0]);
    expect(centroidXs).toEqual([...centroidXs].sort((a, b) => a - b));
    expect(new Set(centroidXs).size).toBe(20);
  });

  it("hulls the two painted runs independently and leaves the center island silent", () => {
    expect(Object.keys(BOUNDARIES).sort()).toEqual(["segment0", "segment1"]);

    const leftEdge = Math.max(...BOUNDARIES.segment0.map(([x]) => x));
    const rightEdge = Math.min(...BOUNDARIES.segment1.map(([x]) => x));
    expect(leftEdge).toBeLessThan(rightEdge);

    const leftEnd = centroid(RAW_STRIPES[9].polygon);
    const rightStart = centroid(RAW_STRIPES[10].polygon);
    const island: Point = [
      (leftEdge + rightEdge) / 2,
      (leftEnd[1] + rightStart[1]) / 2,
    ];

    expect(isPointInPolygon(island, BOUNDARIES.segment0)).toBe(false);
    expect(isPointInPolygon(island, BOUNDARIES.segment1)).toBe(false);
    expect(occupiedStripesFromAllDetections(
      detectionAt(island), "all", FRAME, { stripes: STRIPES, boundaries: BOUNDARIES, referenceFrame: FRAME },
    )).toEqual([]);
  });

  it("keeps a foot point just beyond the paint inside the expanded hit region", () => {
    const raw = RAW_STRIPES[5];
    const processed = STRIPES.find(
      (stripe) => stripe.segment === raw.segment && stripe.stripeIndex === raw.stripeIndex,
    )!;
    const rawPolygon = raw.polygon.map(([x, y]) => [x, y] as Point);
    const minX = Math.min(...rawPolygon.map(([x]) => x));
    const maxX = Math.max(...rawPolygon.map(([x]) => x));
    const minY = Math.min(...rawPolygon.map(([, y]) => y));
    let point: Point | undefined;

    // Find the first quarter-pixel row immediately beyond the top of the
    // detected paint that the 40% expansion intentionally covers.
    for (let offset = 0.25; offset <= 3 && !point; offset += 0.25) {
      for (let x = minX; x <= maxX; x += 0.25) {
        const candidate: Point = [x, minY - offset];
        if (!isPointInPolygon(candidate, rawPolygon) && isPointInPolygon(candidate, processed.polygon)) {
          point = candidate;
          break;
        }
      }
    }

    expect(point).toBeDefined();
    expect(isPointInPolygon(point!, rawPolygon)).toBe(false);
    expect(isPointInPolygon(point!, processed.polygon)).toBe(true);
    expect(occupiedStripesFromAllDetections(
      detectionAt(point!), "all", FRAME, { stripes: STRIPES, boundaries: BOUNDARIES, referenceFrame: FRAME },
    )).toEqual([{ key: stripeKey(processed.segment, processed.stripeIndex), note: processed.note }]);
  });

  it("ascends chromatically from C4 across both runs", () => {
    const midi = STRIPES.map((stripe) => midiForNote(stripe.note));

    expect(STRIPES[0].note).toBe("C4");
    expect(midi).toEqual(Array.from({ length: 20 }, (_, index) => midiForNote("C4")! + index));
  });
});
