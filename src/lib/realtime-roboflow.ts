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

export function scaledRealtimeCrosswalkPolygons(frame: FrameSize) {
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

  return {
    left: scalePolygon(REALTIME_CALIBRATION.leftCrosswalk, frame),
    right: scalePolygon(REALTIME_CALIBRATION.rightCrosswalk, frame),
  };
}
