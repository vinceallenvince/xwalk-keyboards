import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LIVE_CAMERAS } from "@/data/cameras";

import { hlsSourceBaseUrl } from "./hls-sources";

describe("HLS source resolution", () => {
  it("resolves every 511NY stream from server-owned configuration", () => {
    expect(hlsSourceBaseUrl(5056)?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_272/",
    );
    expect(hlsSourceBaseUrl(5059)?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_275/",
    );
    expect(hlsSourceBaseUrl(5062)?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_278/",
    );
    expect(hlsSourceBaseUrl(5072)?.toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_279/",
    );
  });

  it("resolves every Bellevue stream from server-owned configuration", () => {
    for (const [cameraId, stream] of [
      [80003, "CCTV003"], [80007, "CCTV007"], [80009, "CCTV009"], [80027, "CCTV027"],
    ] as const) {
      expect(hlsSourceBaseUrl(cameraId)?.toString()).toBe(
        `https://trafficcams.bellevuewa.gov/traffic-edge/${stream}L.stream/`,
      );
    }
  });

  it("resolves a source for every registered camera", () => {
    // The proxy's 503 "not configured" path stays unreachable while this holds.
    for (const camera of LIVE_CAMERAS) {
      expect(hlsSourceBaseUrl(camera.cameraId), `camera ${camera.cameraId}`).not.toBeNull();
    }
  });

  it("does not resolve unregistered sources", () => {
    expect(hlsSourceBaseUrl(99999)).toBeNull();
  });
});
