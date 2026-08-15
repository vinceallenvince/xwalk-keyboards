import {
  isPointInPolygon,
  scalePolygon,
  type Boundaries,
  type FrameSize,
  type Point,
  type Stripe,
} from "./realtime-calibration";
import { stripeKey } from "./realtime-scale";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

function namedOutput(value: unknown, outputName: string, depth = 0): unknown {
  if (depth > 8 || !value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = namedOutput(item, outputName, depth + 1);
      if (match !== null) return match;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (outputName in value) return value[outputName];
  for (const nested of Object.values(value)) {
    const match = namedOutput(nested, outputName, depth + 1);
    if (match !== null) return match;
  }
  return null;
}

function predictionRecords(value: unknown, depth = 0): UnknownRecord[] {
  if (depth > 8 || !value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => predictionRecords(item, depth + 1));
  if (!isRecord(value)) return [];
  if (Array.isArray(value.predictions)) return value.predictions.filter(isRecord);
  return Object.values(value).flatMap((nested) => predictionRecords(nested, depth + 1));
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function lowerBodyPoint(prediction: UnknownRecord): [number, number] | null {
  const centerX = finiteNumber(prediction.x);
  const centerY = finiteNumber(prediction.y);
  const width = finiteNumber(prediction.width);
  const height = finiteNumber(prediction.height);
  if (centerX !== null && centerY !== null && width !== null && height !== null) {
    return [centerX, centerY + height / 2];
  }

  const box = prediction.bbox ?? prediction.bounding_box;
  if (!isRecord(box)) return null;
  const x = finiteNumber(box.x);
  const y = finiteNumber(box.y);
  const boxWidth = finiteNumber(box.width);
  const boxHeight = finiteNumber(box.height);
  if (x === null || y === null || boxWidth === null || boxHeight === null) return null;
  return [x + boxWidth / 2, y + boxHeight];
}

/**
 * Client-side stripe-for-point using live calibration data.
 *
 * Replaces the server-side polygon filtering that Roboflow used to do. The
 * workflow now returns all person detections, and this function decides which
 * ones are inside a stripe (or inside a crosswalk boundary and near a stripe).
 */
function stripeForPointLive(
  point: Point,
  frame: FrameSize,
  stripes: readonly Stripe[],
  boundaries: Boundaries,
): Stripe | null {
  const scaledStripes = stripes.map((stripe) => ({
    ...stripe,
    polygon: scalePolygon(stripe.polygon, frame),
  }));

  // Direct hit — foot-point is inside a stripe polygon.
  const directHit = scaledStripes.find((s) => isPointInPolygon(point, s.polygon));
  if (directHit) return directHit;

  // Fallback — foot-point is inside a crosswalk boundary, assign to nearest
  // stripe in that boundary's segment.
  const segment = Object.entries(boundaries).find(
    ([, boundary]) => boundary.length >= 3 && isPointInPolygon(point, scalePolygon(boundary, frame)),
  )?.[0] ?? null;
  if (!segment) return null;

  const segmentStripes = scaledStripes.filter((s) => s.segment === segment);
  if (segmentStripes.length === 0) return null;

  let nearest = segmentStripes[0];
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const stripe of segmentStripes) {
    for (const vertex of stripe.polygon) {
      const dist = (point[0] - vertex[0]) ** 2 + (point[1] - vertex[1]) ** 2;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = stripe;
      }
    }
  }
  return nearest;
}

export type ClientCalibration = {
  stripes: readonly Stripe[];
  boundaries: Boundaries;
};

export type OccupiedStripe = { key: string; note: string };

/**
 * Client-side classification: read all detections from the `all` output and
 * test each foot-point against the live calibration stripes and boundaries.
 *
 * Returns the stripes themselves rather than the set of notes they play. Those
 * are not interchangeable: two stripes can share a pitch — the crosswalks'
 * ranges can overlap once one reads long enough — and keying off the note made
 * every stripe sharing it light up when one person stood on any of them.
 * Identity drives the overlay; the note rides along for the audio.
 */
export function occupiedStripesFromAllDetections(
  workflowOutput: unknown,
  allOutputName: string,
  frame: FrameSize,
  calibration: ClientCalibration,
): OccupiedStripe[] {
  const occupied = new Map<string, OccupiedStripe>();
  const output = namedOutput(workflowOutput, allOutputName);
  for (const prediction of predictionRecords(output)) {
    const point = lowerBodyPoint(prediction);
    if (!point) continue;
    const stripe = stripeForPointLive(
      point, frame,
      calibration.stripes,
      calibration.boundaries,
    );
    if (!stripe) continue;
    const key = stripeKey(stripe.segment, stripe.stripeIndex);
    if (!occupied.has(key)) occupied.set(key, { key, note: stripe.note });
  }
  return [...occupied.values()];
}

export function countPredictionsForOutput(workflowOutput: unknown, outputName: string) {
  return predictionRecords(namedOutput(workflowOutput, outputName)).length;
}

/** Extract the foot-point of every detection in a named output. */
export function footPointsFromOutput(workflowOutput: unknown, outputName: string): [number, number][] {
  const points: [number, number][] = [];
  for (const prediction of predictionRecords(namedOutput(workflowOutput, outputName))) {
    const point = lowerBodyPoint(prediction);
    if (point) points.push(point);
  }
  return points;
}
