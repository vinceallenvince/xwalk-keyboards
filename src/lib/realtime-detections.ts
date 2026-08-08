import { stripeForPoint, type FrameSize } from "./realtime-calibration";

type UnknownRecord = Record<string, unknown>;

export type RealtimeOutputBindings = {
  insideLeft: string;
  insideRight: string;
};

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

export function occupiedNotesFromRealtimeOutputs(
  workflowOutput: unknown,
  outputBindings: RealtimeOutputBindings,
  frame: FrameSize
) {
  const notes = new Set<string>();
  for (const outputName of [outputBindings.insideLeft, outputBindings.insideRight]) {
    const output = namedOutput(workflowOutput, outputName);
    for (const prediction of predictionRecords(output)) {
      const point = lowerBodyPoint(prediction);
      const stripe = point && stripeForPoint(point, frame);
      if (stripe) notes.add(stripe.note);
    }
  }
  return [...notes];
}

export function countPredictionsForOutput(workflowOutput: unknown, outputName: string) {
  return predictionRecords(namedOutput(workflowOutput, outputName)).length;
}
