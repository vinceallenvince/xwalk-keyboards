import { describe, expect, it } from "vitest";

import { midiForNote } from "@/lib/realtime-scale";

import { DEFAULT_LIVE_CAMERA, FALLBACK_CAMERAS, LISTED_LIVE_CAMERAS, LIVE_CAMERAS, liveCameraById, PRIORITY_CAMERAS } from "./cameras";

describe("camera registry", () => {
  it("keeps the canonical twelve priority cameras in stable order", () => {
    expect(PRIORITY_CAMERAS.map((camera) => camera.cameraId)).toEqual([
      3256, 3494, 3230, 3326, 3355, 3259, 3282, 3242, 3431, 3456, 3414, 3395,
    ]);
    expect(PRIORITY_CAMERAS[0].displayLabel).toBe("Camera 01 · View 3256");
    expect(PRIORITY_CAMERAS[11].displayLabel).toBe("Camera 12 · View 3395");
  });

  it("keeps fallbacks ordered and Bellevue 80007 as the default live camera", () => {
    expect(FALLBACK_CAMERAS.map((camera) => camera.cameraId)).toEqual([3107, 3231, 3257, 3245]);
    expect(DEFAULT_LIVE_CAMERA).toMatchObject({ cameraId: 80007, location: "Bellevue Way NE & NE 8th St" });
    expect(liveCameraById(80007)).toBe(DEFAULT_LIVE_CAMERA);
    expect(liveCameraById(9999)).toBeUndefined();
  });

  it("registers each Bellevue camera as 8 + its CCTV number", () => {
    for (const [cameraId, sourceId, location, statusLabel] of [
      [80003, "CCTV003", "100th Ave NE & NE 8th St", "100TH AVE @ NE 8TH ST"],
      [80007, "CCTV007", "Bellevue Way NE & NE 8th St", "BELLEVUE WAY @ NE 8TH ST"],
      [80009, "CCTV009", "Bellevue Way NE & Main St", "BELLEVUE WAY @ MAIN ST"],
      [80027, "CCTV027", "110th Ave NE & NE 8th St", "110TH AVE @ NE 8TH ST"],
    ] as const) {
      expect(liveCameraById(cameraId)).toMatchObject({
        baseAnchor: "C4",
        cameraKey: `camera_${cameraId}`,
        location,
        sourceId,
        sourceKind: "bellevue",
        statusLabel,
        viewUrl: `/realtime/${cameraId}`,
      });
    }
  });

  it("keeps the new Bellevue cameras unlisted until 511NY is confirmed down", () => {
    expect(LIVE_CAMERAS.filter((camera) => !camera.listed).map((camera) => camera.cameraId))
      .toEqual([80003, 80009, 80027]);
    expect(LISTED_LIVE_CAMERAS.map((camera) => camera.cameraId))
      .toEqual([5056, 5059, 5062, 5072, 80007, 90014]);
    // The default camera backs the homepage fallback, so it must stay listed.
    expect(DEFAULT_LIVE_CAMERA.listed).toBe(true);
  });

  it("never registers two live cameras under one ID", () => {
    const ids = LIVE_CAMERAS.map((camera) => camera.cameraId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps 511NY cameras north to south, then Bellevue, then CARLA", () => {
    expect(LIVE_CAMERAS.map((camera) => camera.cameraId)).toEqual([5056, 5059, 5062, 5072, 80003, 80007, 80009, 80027, 90014]);
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
    expect(liveCameraById(90014)).toMatchObject({
      baseAnchor: "C4",
      cameraKey: "camera_90014",
      location: "Town10 - Crosswalk 14",
      sourceId: "carla-town10-crosswalk-14",
      sourceKind: "carla",
      statusLabel: "CARLA TOWN10 @ XWALK 14",
      viewUrl: "/realtime/90014",
    });
  });

  it("ships every camera but 5056 without baked-in geometry", () => {
    // They ship with an empty reference on purpose: no keys until the
    // calibration agent first publishes for them (VIN-39).
    for (const cameraId of [5059, 5062, 5072, 80003, 80007, 80009, 80027, 90014]) {
      expect(liveCameraById(cameraId)?.calibration.stripes).toHaveLength(0);
      expect(liveCameraById(cameraId)?.calibration.referenceFrame).toEqual({ height: 240, width: 352 });
    }
  });

  it("keeps upstream stream configuration out of client-importable metadata", () => {
    const serialized = JSON.stringify(LIVE_CAMERAS);
    expect(serialized).not.toContain("CARLA_HLS_BASE_URL");
    expect(serialized).not.toContain("10.150.0.2");
    expect(LIVE_CAMERAS.every((camera) => !("hlsUrl" in camera))).toBe(true);
  });

  it("equips every live camera to drive the realtime study on its own", () => {
    for (const camera of LIVE_CAMERAS) {
      expect(["511ny", "bellevue", "carla"]).toContain(camera.sourceKind);
      expect(camera.statusLabel.length).toBeGreaterThan(0);
      expect(camera.baseAnchor).toBeTruthy();
      expect(midiForNote(camera.baseAnchor)).not.toBeNull();
      expect(camera.calibration.referenceFrame.width).toBeGreaterThan(0);
    }
  });
});
