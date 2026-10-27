import { describe, expect, it } from "vitest";

import { DEFAULT_LIVE_CAMERA, LIVE_CAMERAS, liveCameraById } from "./cameras";

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
        location,
        sourceId,
        sourceKind: "bellevue",
        statusLabel,
      });
    }
  });

  it("never registers two live cameras under one ID", () => {
    const ids = LIVE_CAMERAS.map((camera) => camera.cameraId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps 511NY cameras north to south, then Bellevue", () => {
    expect(LIVE_CAMERAS.map((camera) => camera.cameraId)).toEqual([5056, 5059, 5062, 5072, 80003, 80007, 80009, 80027]);
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

  it("links each camera to its provider's public page, never to a stream", () => {
    for (const camera of LIVE_CAMERAS.filter((camera) => camera.sourceKind === "511ny")) {
      expect(camera.externalUrl).toBe(`https://511ny.org/map/Cctv/${camera.cameraId}`);
    }
    for (const camera of LIVE_CAMERAS.filter((camera) => camera.sourceKind === "bellevue")) {
      expect(camera.externalUrl).toBe("https://trafficmap.bellevuewa.gov/");
    }
    for (const camera of LIVE_CAMERAS) {
      expect(camera.externalUrl).not.toMatch(/\.m3u8|rtplive|\.stream/);
    }
  });

  it("gives every live camera a source kind and a status label", () => {
    for (const camera of LIVE_CAMERAS) {
      expect(["511ny", "bellevue"]).toContain(camera.sourceKind);
      expect(camera.statusLabel.length).toBeGreaterThan(0);
    }
  });

  it("keeps upstream stream configuration out of client-importable metadata", () => {
    const serialized = JSON.stringify(LIVE_CAMERAS);
    expect(serialized).not.toContain("skyvdn.com");
    expect(serialized).not.toContain("trafficcams.bellevuewa.gov");
    expect(LIVE_CAMERAS.every((camera) => !("hlsUrl" in camera))).toBe(true);
  });
});
