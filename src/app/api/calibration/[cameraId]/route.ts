import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = process.env.CALIBRATION_BUCKET ?? "xwalk-keyboards-01";
const PREFIX = process.env.CALIBRATION_GCS_PREFIX ?? "calibration";

type RouteContext = { params: Promise<{ cameraId: string }> };

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

  try {
    const upstream = await fetch(url, {
      cache: "no-store",
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
