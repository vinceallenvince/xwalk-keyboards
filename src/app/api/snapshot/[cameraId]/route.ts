import { createHash } from "node:crypto";

import { findStaticCamera } from "@/data/cameras";
import { classifyCameraImage } from "@/lib/camera-maintenance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ cameraId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { cameraId: rawCameraId } = await context.params;
  const cameraId = Number(rawCameraId);
  const camera = Number.isSafeInteger(cameraId) ? findStaticCamera(cameraId) : undefined;

  if (!camera?.snapshotUrl) {
    return new Response("Unknown snapshot camera", { status: 404 });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(camera.snapshotUrl, {
      cache: "no-store",
      headers: {
        Accept: "image/jpeg,image/*;q=0.8",
        "Accept-Encoding": "identity",
        "User-Agent": "XWALK-KEYBOARDS/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return new Response("Unable to reach camera image", { status: 502 });
  }

  if (!upstreamResponse.ok) {
    return new Response("Camera image unavailable", { status: upstreamResponse.status });
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return new Response("Camera endpoint did not return an image", { status: 502 });
  }

  const image = Buffer.from(await upstreamResponse.arrayBuffer());
  const digest = createHash("sha256").update(image).digest("hex");
  const headers = new Headers({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": contentType,
    "X-Camera-Status": classifyCameraImage(contentType, digest),
    "X-Content-Type-Options": "nosniff",
  });

  for (const headerName of ["etag", "last-modified"]) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) headers.set(`X-Source-${headerName}`, value);
  }

  return new Response(image, { headers, status: 200 });
}
