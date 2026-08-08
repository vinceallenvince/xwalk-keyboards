import { describe, expect, it } from "vitest";

import { classifyCameraImage, KNOWN_UNAVAILABLE_IMAGE_SHA256 } from "./camera-maintenance";

describe("camera unavailable-image classification", () => {
  it("marks only known 511NY unavailable PNGs as unavailable", () => {
    for (const digest of KNOWN_UNAVAILABLE_IMAGE_SHA256) {
      expect(classifyCameraImage("image/png", digest)).toBe("unavailable");
    }
    expect(classifyCameraImage("image/jpeg", "not-a-known-digest")).toBe("active");
  });
});
