import { describe, expect, it } from "vitest";

import { FALLBACK_CAMERAS, PRIORITY_CAMERAS, REALTIME_CAMERA } from "./cameras";

describe("camera registry", () => {
  it("keeps the canonical twelve priority cameras in stable order", () => {
    expect(PRIORITY_CAMERAS.map((camera) => camera.cameraId)).toEqual([
      3256, 3494, 3230, 3326, 3355, 3259, 3282, 3242, 3431, 3456, 3414, 3395,
    ]);
    expect(PRIORITY_CAMERAS[0].displayLabel).toBe("Camera 01 · View 3256");
    expect(PRIORITY_CAMERAS[11].displayLabel).toBe("Camera 12 · View 3395");
  });

  it("keeps fallbacks ordered and uses View 5056 for the future live source", () => {
    expect(FALLBACK_CAMERAS.map((camera) => camera.cameraId)).toEqual([3107, 3231, 3257, 3245]);
    expect(REALTIME_CAMERA).toMatchObject({ cameraId: 5056, location: "West Street at W. 34 St" });
  });
});
