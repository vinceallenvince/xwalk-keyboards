import { liveCameraById } from "@/data/cameras";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;

type RouteContext = { params: Promise<{ cameraId: string; path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { cameraId: rawCameraId, path } = await context.params;
  const cameraId = Number(rawCameraId);

  const camera = Number.isSafeInteger(cameraId) ? liveCameraById(cameraId) : undefined;
  if (!camera) {
    return new Response("Unknown camera", { status: 404 });
  }

  if (path.length === 0 || path.some((segment) => !SAFE_PATH_SEGMENT.test(segment))) {
    return new Response("Invalid HLS path", { status: 400 });
  }

  const upstreamUrl = new URL(camera.hlsUrl);
  const upstreamDirectory = upstreamUrl.pathname.slice(0, upstreamUrl.pathname.lastIndexOf("/") + 1);
  upstreamUrl.pathname = `${upstreamDirectory}${path.join("/")}`;
  upstreamUrl.search = new URL(request.url).search;

  const isManifest = path.at(-1)?.endsWith(".m3u8") ?? false;
  const headers = new Headers({
    Accept: "*/*",
    "Accept-Encoding": "identity",
    "User-Agent": "XWALK-KEYBOARDS/1.0",
  });
  const requestedRange = request.headers.get("range");
  if (!isManifest && requestedRange?.startsWith("bytes=")) headers.set("Range", requestedRange);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      cache: "no-store",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return new Response("Unable to reach camera stream", { status: 502 });
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": upstreamResponse.headers.get("content-type") ?? (
      isManifest ? "application/vnd.apple.mpegurl" : "application/octet-stream"
    ),
    "X-Content-Type-Options": "nosniff",
  });
  for (const headerName of ["accept-ranges", "content-range"]) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) responseHeaders.set(headerName, value);
  }

  return new Response(upstreamResponse.body, { headers: responseHeaders, status: upstreamResponse.status });
}
