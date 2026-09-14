import "server-only";

type Environment = Record<string, string | undefined>;

const PUBLIC_HLS_BASE_URLS: Readonly<Record<number, string>> = {
  5056: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_272/",
  5059: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_275/",
  5062: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_278/",
  5072: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_279/",
};

const CARLA_CAMERA_ID = 90014;

function parseBaseUrl(rawValue: string | undefined): URL | null {
  const raw = rawValue?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  } catch {
    return null;
  }
}

/**
 * Resolve the server-side directory that contains a camera's HLS playlist and
 * segments. This module is protected by `server-only`: browser bundles receive
 * camera metadata and same-origin API paths, never an upstream address.
 */
export function hlsSourceBaseUrl(
  cameraId: number,
  environment: Environment = process.env,
): URL | null {
  if (cameraId === CARLA_CAMERA_ID) {
    return parseBaseUrl(environment.CARLA_HLS_BASE_URL);
  }

  return parseBaseUrl(PUBLIC_HLS_BASE_URLS[cameraId]);
}
