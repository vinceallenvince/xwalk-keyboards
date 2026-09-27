import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hlsAvailabilityForCamera } from "./hls-availability";

describe("HLS source availability", () => {
  it("probes public cameras too, so a retired 511NY stream drops out of navigation", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 504 }));

    await expect(hlsAvailabilityForCamera(5056, {}, fetcher)).resolves.toBe("feed_down");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://s9.nysdot.skyvdn.com/rtplive/R11_272/playlist.m3u8"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("reports a live Bellevue playlist as available", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("#EXTM3U", { status: 200 }));

    await expect(hlsAvailabilityForCamera(80007, {}, fetcher)).resolves.toBe("available");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://trafficcams.bellevuewa.gov/traffic-edge/CCTV007L.stream/playlist.m3u8"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("marks an unregistered camera down without fetching", async () => {
    const fetcher = vi.fn();

    await expect(hlsAvailabilityForCamera(99999, {}, fetcher)).resolves.toBe("feed_down");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("marks CARLA down when its private origin is unconfigured", async () => {
    await expect(hlsAvailabilityForCamera(90014, {}, vi.fn())).resolves.toBe("feed_down");
  });

  it("probes the CARLA playlist without exposing the origin to clients", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("#EXTM3U", { status: 200 }));

    await expect(hlsAvailabilityForCamera(90014, {
      CARLA_HLS_BASE_URL: "http://10.150.0.2:8080/live/",
    }, fetcher)).resolves.toBe("available");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("http://10.150.0.2:8080/live/playlist.m3u8"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("marks CARLA down on an error response or network failure", async () => {
    await expect(hlsAvailabilityForCamera(90014, {
      CARLA_HLS_BASE_URL: "http://10.150.0.2:8080/live/",
    }, vi.fn().mockResolvedValue(new Response(null, { status: 503 })))).resolves.toBe("feed_down");

    await expect(hlsAvailabilityForCamera(90014, {
      CARLA_HLS_BASE_URL: "http://10.150.0.2:8080/live/",
    }, vi.fn().mockRejectedValue(new Error("offline")))).resolves.toBe("feed_down");
  });
});
