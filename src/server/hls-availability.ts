import "server-only";

import { hlsSourceBaseUrl } from "@/server/hls-sources";

const PROBED_CAMERA_IDS = new Set([90014]);
const PROBE_TIMEOUT_MS = 2_000;

export type HlsAvailability = "available" | "feed_down" | "not_probed";

/**
 * Probe sources whose availability cannot be inferred from the calibration
 * record. The temporary CARLA origin is intentionally offline between test
 * windows, so a stale successful calibration must not keep it selectable.
 */
export async function hlsAvailabilityForCamera(
  cameraId: number,
  environment: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<HlsAvailability> {
  if (!PROBED_CAMERA_IDS.has(cameraId)) return "not_probed";

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
