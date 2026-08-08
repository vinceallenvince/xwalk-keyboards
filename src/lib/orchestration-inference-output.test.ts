import { describe, expect, it } from "vitest";

import { normalizeSnapshotInferenceOutput } from "./orchestration-inference-output";

describe("snapshot inference output", () => {
  it("exposes only the annotated image and counts needed by the browser", () => {
    expect(normalizeSnapshotInferenceOutput({
      outputs: [{
        annotated_image: { type: "base64", value: "image-bytes" },
        predictions: { predictions: [{}, {}] },
        inside_crosswalk_predictions: { predictions: [{}] },
        outside_crosswalk_predictions: { predictions: [{}] },
      }],
    })).toEqual({
      annotatedImageUrl: "data:image/jpeg;base64,image-bytes",
      insideCount: 1,
      outsideCount: 1,
      predictionCount: 2,
    });
  });

  it("rejects responses without an annotated base64 image", () => {
    expect(normalizeSnapshotInferenceOutput({ outputs: [{}] })).toBeNull();
  });
});
