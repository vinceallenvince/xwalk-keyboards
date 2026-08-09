import { REALTIME_CALIBRATION, scalePolygon, type FrameSize } from "./realtime-calibration";

const REQUIRED_ENVIRONMENT_VARIABLES = [
  "ROBOFLOW_API_KEY",
  "ROBOFLOW_WORKSPACE",
  "ROBOFLOW_REALTIME_WORKFLOW_ID",
  "ROBOFLOW_IMAGE_INPUT",
  "ROBOFLOW_DATA_OUTPUT",
  "ROBOFLOW_WEBRTC_INSIDE_LEFT_OUTPUT",
  "ROBOFLOW_WEBRTC_INSIDE_RIGHT_OUTPUT",
  "ROBOFLOW_WEBRTC_OUTSIDE_OUTPUT",
  "ROBOFLOW_WEBRTC_LEFT_POLYGON_INPUT",
  "ROBOFLOW_WEBRTC_RIGHT_POLYGON_INPUT",
] as const;

export type RealtimeOutputBindings = {
  all: string;
  insideLeft: string;
  insideRight: string;
  outside: string;
};

export type RealtimeRoboflowConfiguration = {
  apiKey: string;
  classes: string;
  imageInput: string;
  outputBindings: RealtimeOutputBindings;
  polygonInputs: { left: string; right: string };
  region: string;
  requestedPlan: string;
  workflowId: string;
  workspace: string;
};

type Environment = Record<string, string | undefined>;

export function missingRealtimeRoboflowConfiguration(environment: Environment = process.env) {
  return REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !environment[name]?.trim());
}

export function readRealtimeRoboflowConfiguration(
  environment: Environment = process.env
): RealtimeRoboflowConfiguration {
  const missing = missingRealtimeRoboflowConfiguration(environment);
  if (missing.length > 0) {
    throw new Error(`Missing server configuration: ${missing.join(", ")}`);
  }

  const get = (name: string) => environment[name]?.trim() as string;
  return {
    apiKey: get("ROBOFLOW_API_KEY"),
    classes: get("ROBOFLOW_CLASSES") || "person",
    imageInput: get("ROBOFLOW_IMAGE_INPUT"),
    outputBindings: {
      all: get("ROBOFLOW_DATA_OUTPUT"),
      insideLeft: get("ROBOFLOW_WEBRTC_INSIDE_LEFT_OUTPUT"),
      insideRight: get("ROBOFLOW_WEBRTC_INSIDE_RIGHT_OUTPUT"),
      outside: get("ROBOFLOW_WEBRTC_OUTSIDE_OUTPUT"),
    },
    polygonInputs: {
      left: get("ROBOFLOW_WEBRTC_LEFT_POLYGON_INPUT"),
      right: get("ROBOFLOW_WEBRTC_RIGHT_POLYGON_INPUT"),
    },
    region: get("ROBOFLOW_WEBRTC_REGION") || "us",
    requestedPlan: get("ROBOFLOW_WEBRTC_PLAN") || "webrtc-gpu-medium",
    workflowId: get("ROBOFLOW_REALTIME_WORKFLOW_ID"),
    workspace: get("ROBOFLOW_WORKSPACE"),
  };
}

/**
 * Fetch the live calibration from GCS if available, fall back to the baked-in
 * reference. This runs server-side in the WebRTC route so the polygons sent to
 * Roboflow reflect the agent's latest detection, not the stale hand-drawn reference.
 */
async function liveCalibrationPolygons(): Promise<{
  left: readonly (readonly [number, number])[];
  right: readonly (readonly [number, number])[];
}> {
  const bucket = process.env.CALIBRATION_BUCKET ?? "xwalk-keyboards-01";
  const prefix = process.env.CALIBRATION_GCS_PREFIX ?? "calibration";
  const cameraId = REALTIME_CALIBRATION.cameraId;
  const objectPath = `${prefix}/current/camera_${cameraId}.json`;
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;

  try {
    // Get an access token from the metadata server (Cloud Run).
    let token: string | null = null;
    try {
      const tokenResp = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2_000) },
      );
      if (tokenResp.ok) {
        const data = await tokenResp.json() as { access_token?: string };
        token = data.access_token ?? null;
      }
    } catch {
      // Running locally — fall through to reference.
    }

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const resp = await fetch(url, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) throw new Error(`GCS ${resp.status}`);

    const data = await resp.json() as {
      leftCrosswalk?: number[][];
      rightCrosswalk?: number[][];
    };

    const left = data.leftCrosswalk;
    const right = data.rightCrosswalk;
    if (left?.length && right?.length) {
      return {
        left: left.map(([x, y]) => [x, y] as const),
        right: right.map(([x, y]) => [x, y] as const),
      };
    }
  } catch {
    // Fall back to reference on any failure.
  }

  return {
    left: REALTIME_CALIBRATION.leftCrosswalk,
    right: REALTIME_CALIBRATION.rightCrosswalk,
  };
}

export async function scaledRealtimeCrosswalkPolygons(frame: FrameSize) {
  if (
    !Number.isInteger(frame.width) ||
    !Number.isInteger(frame.height) ||
    frame.width < 1 ||
    frame.height < 1 ||
    frame.width > 4096 ||
    frame.height > 4096
  ) {
    throw new Error("A valid WebRTC frame size is required");
  }

  const polygons = await liveCalibrationPolygons();

  return {
    left: scalePolygon(polygons.left, frame),
    right: scalePolygon(polygons.right, frame),
  };
}
