import "server-only";

const PUBLIC_HLS_BASE_URLS: Readonly<Record<number, string>> = {
  5056: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_272/",
  5059: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_275/",
  5062: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_278/",
  5072: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_279/",
  // City of Bellevue, keyed 8 + the CCTV number (see LIVE_CAMERAS). The
  // city's own player builds these from its public config.js; there is no key.
  80003: "https://trafficcams.bellevuewa.gov:443/traffic-edge/CCTV003L.stream/",
  80007: "https://trafficcams.bellevuewa.gov:443/traffic-edge/CCTV007L.stream/",
  80009: "https://trafficcams.bellevuewa.gov:443/traffic-edge/CCTV009L.stream/",
  80027: "https://trafficcams.bellevuewa.gov:443/traffic-edge/CCTV027L.stream/",
};

/**
 * Resolve the server-side directory that contains a camera's HLS playlist and
 * segments. This module is protected by `server-only`: browser bundles receive
 * camera metadata and same-origin API paths, never an upstream address.
 */
export function hlsSourceBaseUrl(cameraId: number): URL | null {
  const base = PUBLIC_HLS_BASE_URLS[cameraId];
  return base ? new URL(base) : null;
}
