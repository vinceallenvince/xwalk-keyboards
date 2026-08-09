/**
 * Polygon simplification and dilation.
 *
 * Applied to the raw Roboflow instance-segmentation polygons when calibration
 * data is loaded, before the polygons reach the overlay renderer or the
 * `isPointInPolygon` hit-test.
 *
 * 1. Simplify (convex hull) — the painted bars are convex rectangles, so their
 *    convex hull cleanly removes pixel-tracing jaggedness without the edge
 *    cases of RDP on closed rings.
 * 2. Expand (scale from centroid) — grow each polygon outward so a pedestrian
 *    stepping slightly off the paint still triggers the note.
 */

import type { Point } from "./realtime-calibration";

// ---------------------------------------------------------------------------
// Convex hull (Andrew's monotone chain)
// ---------------------------------------------------------------------------

function cross(o: Point, a: Point, b: Point): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function simplifyPolygon(polygon: readonly Point[]): Point[] {
  if (polygon.length <= 4) return [...polygon];

  const pts = [...polygon].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  // Remove last point of each half because it's repeated.
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// ---------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------

/**
 * Expand a polygon vertically only — scale Y away from centroid, leave X alone.
 */
export function expandPolygonY(polygon: readonly Point[], factor = 1.2): Point[] {
  if (polygon.length === 0) return [];
  const cy = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;
  return polygon.map(([x, y]) => [x, cy + (y - cy) * factor] as const as Point);
}

/**
 * Expand a polygon outward by scaling each vertex away from the centroid.
 */
export function expandPolygon(polygon: readonly Point[], factor = 1.4): Point[] {
  if (polygon.length === 0) return [];
  const cx = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length;
  const cy = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;
  return polygon.map(([x, y]) => [
    cx + (x - cx) * factor,
    cy + (y - cy) * factor,
  ] as const as Point);
}

/**
 * Simplify then expand — the standard transform for Roboflow stripe polygons.
 */
export function processPolygon(
  polygon: readonly Point[],
  { expansion = 1.4 } = {},
): Point[] {
  return expandPolygon(simplifyPolygon(polygon), expansion);
}
