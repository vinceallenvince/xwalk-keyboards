import { describe, expect, it } from "vitest";

import { midiForNote } from "@/lib/realtime-scale";

import { DEFAULT_LIVE_CAMERA, LISTED_LIVE_CAMERAS, LIVE_CAMERAS, liveCameraById } from "./cameras";

describe("camera registry", () => {
  it("keeps 511NY 5059 as the default live camera", () => {
    expect(DEFAULT_LIVE_CAMERA).toMatchObject({ cameraId: 5059, location: "West Street at W. 23 St" });
    expect(liveCameraById(5059)).toBe(DEFAULT_LIVE_CAMERA);
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
      });
    }
  });

  it("keeps Bellevue 80003, 80009, and 80027 unlisted", () => {
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
    });
  });

  it("links each camera to its provider's public page, never to a stream", () => {
    for (const camera of LIVE_CAMERAS.filter((camera) => camera.sourceKind === "511ny")) {
      expect(camera.externalUrl).toBe(`https://511ny.org/map/Cctv/${camera.cameraId}`);
    }
    for (const camera of LIVE_CAMERAS.filter((camera) => camera.sourceKind === "bellevue")) {
      expect(camera.externalUrl).toBe("https://trafficmap.bellevuewa.gov/");
    }
    // The CARLA origin is private: there is no public page to open.
    expect(liveCameraById(90014)?.externalUrl).toBeUndefined();
    for (const camera of LIVE_CAMERAS) {
      expect(camera.externalUrl ?? "").not.toMatch(/\.m3u8|rtplive|\.stream/);
    }
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
