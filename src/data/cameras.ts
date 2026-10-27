export type CameraRecord = {
  cameraId: number;
  displayLabel: string;
  /**
   * The provider's public page for this camera, opened from the camera
   * registry. Absent when there is none (the private CARLA origin). Never an
   * upstream media URL: those stay server-side in src/server/hls-sources.ts.
   */
  externalUrl?: string;
  location: string;
  sourceId: string;
};

const nysCameraPageUrl = (cameraId: number) => `https://511ny.org/map/Cctv/${cameraId}`;

/** Bellevue's public map has no per-camera deep link, so every camera opens the map. */
const BELLEVUE_TRAFFIC_MAP_URL = "https://trafficmap.bellevuewa.gov/";

/**
 * A registered live camera. On top of the registry record it carries the
 * source kind and the status-bar label the ambient backgrounds and the camera
 * registry show. Upstream locations deliberately live in a server-only module.
 */
export type LiveCameraRecord = CameraRecord & {
  sourceKind: "511ny" | "bellevue" | "carla";
  statusLabel: string;
};

export const LIVE_CAMERAS: readonly LiveCameraRecord[] = [
  {
    cameraId: 5056,
    displayLabel: "Live Feed · View 5056",
    sourceKind: "511ny",
    location: "West Street at W. 34 St",
    sourceId: "16090",
    statusLabel: "WEST STREET @ W34 ST",
    externalUrl: nysCameraPageUrl(5056),
  },
  {
    cameraId: 5059,
    displayLabel: "Live Feed · View 5059",
    sourceKind: "511ny",
    location: "West Street at W. 23 St",
    // 511NY map site id (the /tooltip/Cameras/<id> key for this view).
    sourceId: "913",
    statusLabel: "WEST STREET @ W23 ST",
    externalUrl: nysCameraPageUrl(5059),
  },
  {
    cameraId: 5062,
    displayLabel: "Live Feed · View 5062",
    sourceKind: "511ny",
    location: "West Street at Spring St",
    sourceId: "16096",
    statusLabel: "WEST STREET @ SPRING ST",
    externalUrl: nysCameraPageUrl(5062),
  },
  {
    cameraId: 5072,
    displayLabel: "Live Feed · View 5072",
    sourceKind: "511ny",
    location: "West Street at Chambers St",
    // 511NY map site id (the /tooltip/Cameras/<id> key for this view).
    sourceId: "927",
    statusLabel: "WEST STREET @ CHAMBERS ST",
    externalUrl: nysCameraPageUrl(5072),
  },
  {
    // Bellevue cameras use made-up IDs: 8 then the city's CCTV number,
    // zero-padded (CCTV007 -> 80007), in CARLA's 90014 style. The city's own
    // IDs aren't numeric, and the retired calibration agent's BigQuery schema
    // stored camera_id as an integer.
    cameraId: 80003,
    displayLabel: "Live Feed · Bellevue CCTV003",
    location: "100th Ave NE & NE 8th St",
    sourceId: "CCTV003",
    sourceKind: "bellevue",
    statusLabel: "100TH AVE @ NE 8TH ST",
    externalUrl: BELLEVUE_TRAFFIC_MAP_URL,
  },
  {
    cameraId: 80007,
    displayLabel: "Live Feed · Bellevue CCTV007",
    location: "Bellevue Way NE & NE 8th St",
    sourceId: "CCTV007",
    sourceKind: "bellevue",
    statusLabel: "BELLEVUE WAY @ NE 8TH ST",
    externalUrl: BELLEVUE_TRAFFIC_MAP_URL,
  },
  {
    cameraId: 80009,
    displayLabel: "Live Feed · Bellevue CCTV009",
    location: "Bellevue Way NE & Main St",
    sourceId: "CCTV009",
    sourceKind: "bellevue",
    statusLabel: "BELLEVUE WAY @ MAIN ST",
    externalUrl: BELLEVUE_TRAFFIC_MAP_URL,
  },
  {
    cameraId: 80027,
    displayLabel: "Live Feed · Bellevue CCTV027",
    location: "110th Ave NE & NE 8th St",
    sourceId: "CCTV027",
    sourceKind: "bellevue",
    statusLabel: "110TH AVE @ NE 8TH ST",
    externalUrl: BELLEVUE_TRAFFIC_MAP_URL,
  },
  {
    cameraId: 90014,
    displayLabel: "Live Feed · CARLA 90014",
    location: "Town10 - Crosswalk 14",
    sourceId: "carla-town10-crosswalk-14",
    sourceKind: "carla",
    statusLabel: "CARLA TOWN10 @ XWALK 14",
  },
];

export function liveCameraById(cameraId: number) {
  return LIVE_CAMERAS.find((camera) => camera.cameraId === cameraId);
}

/**
 * The ambient background on the homepage and About page. Briefly Bellevue 80007 (VIN-79) while 511NY
 * planned to drop public video; back on 5059 once it kept video (VIN-87).
 */
export const DEFAULT_LIVE_CAMERA = liveCameraById(5059)!;
