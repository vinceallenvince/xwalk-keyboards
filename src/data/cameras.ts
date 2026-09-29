import { REALTIME_CALIBRATION, type ReferenceCalibration } from "@/lib/realtime-calibration";

export type CameraRole = "priority" | "fallback" | "live";

export type CameraRecord = {
  cameraId: number;
  cameraKey: string;
  displayLabel: string;
  location: string;
  role: CameraRole;
  slot?: number;
  snapshotUrl?: string;
  sourceId: string;
  viewUrl: string;
};

const snapshotUrl = (cameraId: number) => `https://511ny.org/map/Cctv/${cameraId}`;

const priorityCameraSeeds = [
  [3256, "static-3256", "5 Avenue @ 34 Street"],
  [3494, "static-3494", "511NY camera view 3494"],
  [3230, "static-3230", "511NY camera view 3230"],
  [3326, "static-3326", "511NY camera view 3326"],
  [3355, "static-3355", "511NY camera view 3355"],
  [3259, "static-3259", "5 Avenue @ 57 Street"],
  [3282, "static-3282", "511NY camera view 3282"],
  [3242, "static-3242", "511NY camera view 3242"],
  [3431, "static-3431", "511NY camera view 3431"],
  [3456, "static-3456", "511NY camera view 3456"],
  [3414, "static-3414", "511NY camera view 3414"],
  [3395, "static-3395", "511NY camera view 3395"],
] as const;

const fallbackCameraSeeds = [
  [3107, "static-3107", "511NY fallback camera view 3107"],
  [3231, "static-3231", "511NY fallback camera view 3231"],
  [3257, "static-3257", "5 Avenue @ 42 Street"],
  [3245, "static-3245", "511NY fallback camera view 3245"],
] as const;

function createStaticCameras(
  seeds: readonly (readonly [number, string, string])[],
  role: "priority" | "fallback",
  // Registry display numbering continues across sections (Camera 01-12
  // priority, then 13-16 fallback) so no card number appears twice on the
  // page; `slot` stays independent (1-based within its own section) since
  // orchestration logic keys fallback substitution off it.
  displayIndexOffset = 0
): CameraRecord[] {
  return seeds.map(([cameraId, sourceId, location], index) => ({
    cameraId,
    cameraKey: `camera_${cameraId}`,
    displayLabel: `Camera ${String(displayIndexOffset + index + 1).padStart(2, "0")} · View ${cameraId}`,
    location,
    role,
    slot: index + 1,
    snapshotUrl: snapshotUrl(cameraId),
    sourceId,
    viewUrl: snapshotUrl(cameraId),
  }));
}

// Curated from 511NY-test/src/data/camera.ts. This registry is deliberately
// source-controlled and has no runtime dependency on the prototype repository.
export const PRIORITY_CAMERAS = createStaticCameras(priorityCameraSeeds, "priority");
export const FALLBACK_CAMERAS = createStaticCameras(fallbackCameraSeeds, "fallback", PRIORITY_CAMERAS.length);

/**
 * A camera the Realtime study can play. On top of the registry record it
 * carries everything the browser needs to be camera-agnostic: the source kind,
 * status-bar label, the pitch its keyboard starts from, and the baked-in
 * reference calibration used when the agent has never published for this
 * camera. Upstream locations deliberately live in a server-only module.
 */
export type LiveCameraRecord = CameraRecord & {
  sourceKind: "511ny" | "bellevue" | "carla";
  statusLabel: string;
  /**
   * The note the crossing's first stripe plays. Every stripe after it climbs
   * one semitone, counted across all clusters — so this single value tunes the
   * whole instrument. There is deliberately no per-cluster anchor: the agent's
   * cluster count is not fixed (a truck parked mid-crosswalk splits one run
   * into two), so anything keyed to a specific cluster would be guessing.
   */
  baseAnchor: string;
  /**
   * Whether navigation offers this camera: the homepage links and the
   * "try one of these" list on a camera with no crosswalk. An unlisted camera
   * still has its /realtime page, stream, and calibration — it just isn't
   * suggested to visitors. Flipped by hand, not by a date or a feed probe.
   */
  listed: boolean;
  calibration: ReferenceCalibration;
};

export const LIVE_CAMERAS: readonly LiveCameraRecord[] = [
  {
    cameraId: 5056,
    cameraKey: "camera_5056",
    displayLabel: "Live Feed · View 5056",
    sourceKind: "511ny",
    location: "West Street at W. 34 St",
    role: "live",
    sourceId: "16090",
    statusLabel: "WEST STREET @ W34 ST",
    viewUrl: snapshotUrl(5056),
    // On a complete read this reproduces the original hand-calibrated keyboard
    // exactly — 18 left stripes C4-F5, then 7 right stripes F#5-C6 — because
    // the two crosswalks were always one continuous chromatic run, and global
    // numbering is just that run stated directly.
    baseAnchor: "C4",
    listed: true,
    calibration: REALTIME_CALIBRATION,
  },
  {
    cameraId: 5059,
    cameraKey: "camera_5059",
    displayLabel: "Live Feed · View 5059",
    sourceKind: "511ny",
    location: "West Street at W. 23 St",
    role: "live",
    // 511NY map site id (the /tooltip/Cameras/<id> key for this view).
    sourceId: "913",
    statusLabel: "WEST STREET @ W23 ST",
    viewUrl: snapshotUrl(5059),
    baseAnchor: "C4",
    listed: true,
    // Empty reference for the same reason as 5072: no keys until the agent
    // publishes for this camera.
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
  {
    cameraId: 5062,
    cameraKey: "camera_5062",
    displayLabel: "Live Feed · View 5062",
    sourceKind: "511ny",
    location: "West Street at Spring St",
    role: "live",
    sourceId: "16096",
    statusLabel: "WEST STREET @ SPRING ST",
    viewUrl: snapshotUrl(5062),
    baseAnchor: "C4",
    listed: true,
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
  {
    cameraId: 5072,
    cameraKey: "camera_5072",
    displayLabel: "Live Feed · View 5072",
    sourceKind: "511ny",
    location: "West Street at Chambers St",
    role: "live",
    // 511NY map site id (the /tooltip/Cameras/<id> key for this view).
    sourceId: "927",
    statusLabel: "WEST STREET @ CHAMBERS ST",
    viewUrl: snapshotUrl(5072),
    baseAnchor: "C4",
    listed: true,
    // No baked-in reference geometry: the keyboard has no keys until the
    // agent's first publish (or the local fallback JSON) provides stripes.
    // Video and inference run either way — silence here is honest, not broken.
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
  {
    // Bellevue cameras use made-up IDs: 8 then the city's CCTV number,
    // zero-padded (CCTV007 -> 80007), in CARLA's 90014 style. The city's own
    // IDs aren't numeric, and the calibration agent's BigQuery schema stores
    // camera_id as an integer.
    cameraId: 80003,
    cameraKey: "camera_80003",
    displayLabel: "Live Feed · Bellevue CCTV003",
    location: "100th Ave NE & NE 8th St",
    role: "live",
    sourceId: "CCTV003",
    sourceKind: "bellevue",
    statusLabel: "100TH AVE @ NE 8TH ST",
    viewUrl: "/realtime/80003",
    baseAnchor: "C4",
    // Unlisted (VIN-86): reachable by URL, kept out of navigation by hand.
    listed: false,
    // No baked-in geometry: no keys until the calibration agent publishes for
    // this camera or a reviewed public/calibration-fallback-80003.json lands.
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
  {
    cameraId: 80007,
    cameraKey: "camera_80007",
    displayLabel: "Live Feed · Bellevue CCTV007",
    location: "Bellevue Way NE & NE 8th St",
    role: "live",
    sourceId: "CCTV007",
    sourceKind: "bellevue",
    statusLabel: "BELLEVUE WAY @ NE 8TH ST",
    viewUrl: "/realtime/80007",
    baseAnchor: "C4",
    listed: true,
    // No baked-in geometry: no keys until the calibration agent publishes for
    // this camera or a reviewed public/calibration-fallback-80007.json lands.
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
  {
    cameraId: 80009,
    cameraKey: "camera_80009",
    displayLabel: "Live Feed · Bellevue CCTV009",
    location: "Bellevue Way NE & Main St",
    role: "live",
    sourceId: "CCTV009",
    sourceKind: "bellevue",
    statusLabel: "BELLEVUE WAY @ MAIN ST",
    viewUrl: "/realtime/80009",
    baseAnchor: "C4",
    // Unlisted (VIN-86): reachable by URL, kept out of navigation by hand.
    listed: false,
    // No baked-in geometry: no keys until the calibration agent publishes for
    // this camera or a reviewed public/calibration-fallback-80009.json lands.
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
  {
    cameraId: 80027,
    cameraKey: "camera_80027",
    displayLabel: "Live Feed · Bellevue CCTV027",
    location: "110th Ave NE & NE 8th St",
    role: "live",
    sourceId: "CCTV027",
    sourceKind: "bellevue",
    statusLabel: "110TH AVE @ NE 8TH ST",
    viewUrl: "/realtime/80027",
    baseAnchor: "C4",
    // Unlisted (VIN-86): reachable by URL, kept out of navigation by hand.
    listed: false,
    // No baked-in geometry: no keys until the calibration agent publishes for
    // this camera or a reviewed public/calibration-fallback-80027.json lands.
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
  {
    cameraId: 90014,
    cameraKey: "camera_90014",
    displayLabel: "Live Feed · CARLA 90014",
    location: "Town10 - Crosswalk 14",
    role: "live",
    sourceId: "carla-town10-crosswalk-14",
    sourceKind: "carla",
    statusLabel: "CARLA TOWN10 @ XWALK 14",
    viewUrl: "/realtime/90014",
    baseAnchor: "C4",
    listed: true,
    // The reviewed static calibration lives in
    // public/calibration-fallback-90014.json. Keep this embedded reference
    // empty so the client never carries a second copy of that geometry.
    calibration: {
      boundaries: {},
      referenceFrame: { height: 240, width: 352 },
      stripes: [],
    },
  },
];

/** The live cameras navigation may suggest to visitors. */
export const LISTED_LIVE_CAMERAS = LIVE_CAMERAS.filter((camera) => camera.listed);

export function liveCameraById(cameraId: number) {
  return LIVE_CAMERAS.find((camera) => camera.cameraId === cameraId);
}

/**
 * The camera behind `/realtime` with no ID, and the ambient background on the
 * homepage and About page. Briefly Bellevue 80007 (VIN-79) while 511NY
 * planned to drop public video; back on 5059 once it kept video (VIN-87).
 */
export const DEFAULT_LIVE_CAMERA = liveCameraById(5059)!;

export const STATIC_CAMERAS = [...PRIORITY_CAMERAS, ...FALLBACK_CAMERAS] as const;

export function findStaticCamera(cameraId: number) {
  return STATIC_CAMERAS.find((camera) => camera.cameraId === cameraId);
}
