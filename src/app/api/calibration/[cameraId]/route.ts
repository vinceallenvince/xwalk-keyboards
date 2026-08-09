import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = process.env.CALIBRATION_BUCKET ?? "xwalk-keyboards-01";
const PREFIX = process.env.CALIBRATION_GCS_PREFIX ?? "calibration";

type RouteContext = { params: Promise<{ cameraId: string }> };

/**
 * Fetch an access token from the GCE metadata server. On Cloud Run this
 * returns the runtime service account's token; locally it returns nothing
 * (and the route falls back to unauthenticated access, which will 401/403
 * against a private bucket — acceptable for dev since the client falls back
 * to the baked-in reference).
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2_000) },
    );
    if (!response.ok) return null;
    const data = await response.json() as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/calibration/[cameraId]
 *
 * Returns the current calibration JSON from GCS. The web client calls this on
 * page load (and periodically for long-lived sessions) instead of using the
 * baked-in constants in realtime-calibration.ts.
 *
 * Falls back to a 404 when no calibration has been published yet, which the
 * client treats as "use the baked-in reference".
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { cameraId: rawCameraId } = await context.params;
  const cameraId = Number(rawCameraId);

  if (!Number.isSafeInteger(cameraId) || cameraId <= 0) {
    return new Response("Invalid camera ID", { status: 400 });
  }

  const objectPath = `${PREFIX}/current/camera_${cameraId}.json`;
  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;

  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const upstream = await fetch(url, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(8_000),
    });

    if (upstream.status === 404) {
      return new Response("No calibration published yet", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!upstream.ok) {
      return new Response("Failed to fetch calibration", { status: 502 });
    }

    const body = await upstream.text();

    return new Response(body, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Calibration service unavailable", { status: 502 });
  }
}
