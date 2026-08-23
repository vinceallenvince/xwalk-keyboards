import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { LIVE_CAMERAS } from "@/data/cameras";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = process.env.CALIBRATION_BUCKET ?? "xwalk-keyboards-01";
const PREFIX = process.env.CALIBRATION_GCS_PREFIX ?? "calibration";

type CameraStatus = { cameraId: number; status: string; crosswalkRank: number };

/** Default rank when the field is absent (mid-tier). */
const DEFAULT_RANK = 3;

/**
 * Fetch an access token from the GCE metadata server. On Cloud Run this
 * returns the runtime service account's token; locally it returns nothing.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2_000) },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the status from a local fallback calibration JSON when GCS is
 * unreachable (e.g. local dev without metadata-server auth).
 */
async function fallbackCalibration(cameraId: number): Promise<{ status: string; crosswalkRank: number }> {
  try {
    const filePath = join(process.cwd(), "public", `calibration-fallback-${cameraId}.json`);
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as { status?: string; crosswalk_rank?: number };
    return {
      status: data.status ?? "ok",
      crosswalkRank: data.crosswalk_rank ?? DEFAULT_RANK,
    };
  } catch {
    return { status: "ok", crosswalkRank: DEFAULT_RANK };
  }
}

/**
 * GET /api/calibration/status
 *
 * Returns `{ cameras: [{ cameraId, status, crosswalkRank }] }` for every registered live
 * camera. The homepage calls this once on load to decide which camera links
 * to show — cameras with `no_crosswalk` are excluded from the link list
 * unless all cameras are rotated.
 */
export async function GET() {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const results: CameraStatus[] = await Promise.all(
    LIVE_CAMERAS.map(async (camera): Promise<CameraStatus> => {
      const objectPath = `${PREFIX}/current/camera_${camera.cameraId}.json`;
      const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;

      try {
        const response = await fetch(url, {
          cache: "no-store",
          headers,
          signal: AbortSignal.timeout(8_000),
        });

        // No calibration published yet — the camera uses its baked-in
        // reference, which is always playable (status "ok").
        if (response.status === 404) {
          return { cameraId: camera.cameraId, status: "ok", crosswalkRank: DEFAULT_RANK };
        }

        if (!response.ok) {
          const fb = await fallbackCalibration(camera.cameraId);
          return { cameraId: camera.cameraId, ...fb };
        }

        const data = (await response.json()) as { status?: string; crosswalk_rank?: number };
        return {
          cameraId: camera.cameraId,
          status: data.status ?? "ok",
          crosswalkRank: data.crosswalk_rank ?? DEFAULT_RANK,
        };
      } catch {
        const fb = await fallbackCalibration(camera.cameraId);
        return { cameraId: camera.cameraId, ...fb };
      }
    }),
  );

  return new Response(JSON.stringify({ cameras: results }), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
