import "server-only";

import { hlsSourceBaseUrl } from "@/server/hls-sources";

const PROBE_TIMEOUT_MS = 2_000;

export type HlsAvailability = "available" | "feed_down";

/**
 * Probe a camera's playlist, since availability cannot be inferred from the
 * calibration record. A stale successful calibration must not keep a dead
 * stream selectable: the CARLA origin is intentionally offline between test
 * windows, and individual 511NY streams go down for days at a time.
 */
export async function hlsAvailabilityForCamera(
  cameraId: number,
  environment: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HlsAvailability> {
  const baseUrl = hlsSourceBaseUrl(cameraId, environment);
  if (!baseUrl) return "feed_down";

  try {
    const response = await fetcher(new URL("playlist.m3u8", baseUrl), {
      cache: "no-store",
      headers: { "Accept-Encoding": "identity" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok ? "available" : "feed_down";
  } catch {
    return "feed_down";
  }
}
