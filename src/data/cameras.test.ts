import { describe, expect, it } from "vitest";

import { midiForNote } from "@/lib/realtime-scale";

import { DEFAULT_LIVE_CAMERA, FALLBACK_CAMERAS, LIVE_CAMERAS, liveCameraById, PRIORITY_CAMERAS } from "./cameras";

describe("camera registry", () => {
  it("keeps the canonical twelve priority cameras in stable order", () => {
    expect(PRIORITY_CAMERAS.map((camera) => camera.cameraId)).toEqual([
      3256, 3494, 3230, 3326, 3355, 3259, 3282, 3242, 3431, 3456, 3414, 3395,
    ]);
    expect(PRIORITY_CAMERAS[0].displayLabel).toBe("Camera 01 · View 3256");
    expect(PRIORITY_CAMERAS[11].displayLabel).toBe("Camera 12 · View 3395");
  });

  it("keeps fallbacks ordered and View 5056 as the default live camera", () => {
    expect(FALLBACK_CAMERAS.map((camera) => camera.cameraId)).toEqual([3107, 3231, 3257, 3245]);
    expect(DEFAULT_LIVE_CAMERA).toMatchObject({ cameraId: 5056, location: "West Street at W. 34 St" });
    expect(liveCameraById(5056)).toBe(DEFAULT_LIVE_CAMERA);
    expect(liveCameraById(9999)).toBeUndefined();
  });

  it("orders the live cameras north to south without dethroning the default", () => {
    expect(LIVE_CAMERAS.map((camera) => camera.cameraId)).toEqual([5056, 5059, 5072]);
    expect(liveCameraById(5059)).toMatchObject({
      cameraId: 5059,
      location: "West Street at W. 23 St",
      statusLabel: "WEST STREET @ W23 ST",
    });
    expect(liveCameraById(5072)).toMatchObject({
      cameraId: 5072,
      location: "West Street at Chambers St",
      statusLabel: "WEST STREET @ CHAMBERS ST",
    });
  });

  it("ships 5059 and 5072 without baked-in geometry", () => {
    // Both ship with an empty reference on purpose: no keys until the
    // calibration agent first publishes for them (VIN-39).
    for (const cameraId of [5059, 5072]) {
      expect(liveCameraById(cameraId)?.calibration.stripes).toHaveLength(0);
      expect(liveCameraById(cameraId)?.calibration.referenceFrame).toEqual({ height: 240, width: 352 });
    }
  });

  it("gives every live camera a distinct stream", () => {
    const streams = LIVE_CAMERAS.map((camera) => camera.hlsUrl);
    expect(new Set(streams).size).toBe(LIVE_CAMERAS.length);
  });

  it("equips every live camera to drive the realtime study on its own", () => {
    for (const camera of LIVE_CAMERAS) {
      expect(camera.hlsUrl).toMatch(/^https:/);
      expect(camera.statusLabel.length).toBeGreaterThan(0);
      expect(camera.baseAnchor).toBeTruthy();
      expect(midiForNote(camera.baseAnchor)).not.toBeNull();
      expect(camera.calibration.referenceFrame.width).toBeGreaterThan(0);
    }
  });
});
