import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "./route";

const context = (cameraId: string, path: string[]) => ({
  params: Promise.resolve({ cameraId, path }),
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("HLS proxy", () => {
  it("keeps existing 511NY cameras on their server-owned upstreams", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("playlist", {
      headers: { "content-type": "application/vnd.apple.mpegurl" },
    }));

    const response = await GET(
      new Request("http://localhost/api/hls/5056/playlist.m3u8?token=abc"),
      context("5056", ["playlist.m3u8"]),
    );

    expect(response.status).toBe(200);
    const upstream = fetchMock.mock.calls[0]?.[0];
    expect(upstream).toBeInstanceOf(URL);
    expect((upstream as URL).toString()).toBe(
      "https://s9.nysdot.skyvdn.com/rtplive/R11_272/playlist.m3u8?token=abc",
    );
    expect(await response.text()).toBe("playlist");
    expect(response.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("proxies CARLA media segments with their binary response headers", async () => {
    vi.stubEnv("CARLA_HLS_BASE_URL", "http://10.150.0.2:8080/live/");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("segment", {
      headers: {
        "accept-ranges": "bytes",
        "content-type": "video/MP2T",
      },
    }));

    const response = await GET(
      new Request("http://localhost/api/hls/90014/segment-000123.ts"),
      context("90014", ["segment-000123.ts"]),
    );

    expect(response.status).toBe(200);
    const [upstream] = fetchMock.mock.calls[0];
    expect((upstream as URL).toString()).toBe(
      "http://10.150.0.2:8080/live/segment-000123.ts",
    );
    expect(await response.text()).toBe("segment");
    expect(response.headers.get("content-type")).toBe("video/MP2T");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  it("rejects unknown cameras before attempting an upstream request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      new Request("http://localhost/api/hls/99999/playlist.m3u8"),
      context("99999", ["playlist.m3u8"]),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects traversal and unsafe path segments", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    for (const path of [
      [],
      ["..", "secret.ts"],
      [".", "playlist.m3u8"],
      ["nested/slash.ts"],
      ["segment%2Fescape.ts"],
    ]) {
      const response = await GET(
        new Request("http://localhost/api/hls/5056/playlist.m3u8"),
        context("5056", path),
      );
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a retryable service error when CARLA is not configured", async () => {
    vi.stubEnv("CARLA_HLS_BASE_URL", "");
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      new Request("http://localhost/api/hls/90014/playlist.m3u8"),
      context("90014", ["playlist.m3u8"]),
    );

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps CARLA network failures onto the existing bad-gateway response", async () => {
    vi.stubEnv("CARLA_HLS_BASE_URL", "http://10.150.0.2:8080/live/");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("origin down"));
    const response = await GET(
      new Request("http://localhost/api/hls/90014/playlist.m3u8"),
      context("90014", ["playlist.m3u8"]),
    );

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toBe("Unable to reach camera stream");
  });
});
