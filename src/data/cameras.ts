export type CameraRole = "priority" | "fallback" | "live";

export type CameraRecord = {
  cameraId: number;
  cameraKey: string;
  displayLabel: string;
  hlsUrl?: string;
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

export const REALTIME_CAMERA: CameraRecord = {
  cameraId: 5056,
  cameraKey: "camera_5056",
  displayLabel: "Live Feed · View 5056",
  hlsUrl: "https://s9.nysdot.skyvdn.com:443/rtplive/R11_272/playlist.m3u8",
  location: "West Street at W. 34 St",
  role: "live",
  sourceId: "16090",
  viewUrl: snapshotUrl(5056),
};

export const STATIC_CAMERAS = [...PRIORITY_CAMERAS, ...FALLBACK_CAMERAS] as const;

export function findStaticCamera(cameraId: number) {
  return STATIC_CAMERAS.find((camera) => camera.cameraId === cameraId);
}
