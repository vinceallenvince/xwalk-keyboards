type UnknownRecord = Record<string, unknown>;

export type SnapshotInferenceOutput = {
  annotatedImageUrl: string;
  insideCount: number;
  outsideCount: number;
  predictionCount: number;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function predictionCount(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.predictions)) return 0;
  return value.predictions.length;
}

export function normalizeSnapshotInferenceOutput(value: unknown): SnapshotInferenceOutput | null {
  if (!isRecord(value) || !Array.isArray(value.outputs) || !isRecord(value.outputs[0])) return null;
  const output = value.outputs[0];
  const annotatedImage = output.annotated_image;
  if (!isRecord(annotatedImage) || annotatedImage.type !== "base64" || typeof annotatedImage.value !== "string") return null;

  return {
    annotatedImageUrl: `data:image/jpeg;base64,${annotatedImage.value}`,
    insideCount: predictionCount(output.inside_crosswalk_predictions),
    outsideCount: predictionCount(output.outside_crosswalk_predictions),
    predictionCount: predictionCount(output.predictions),
  };
}
