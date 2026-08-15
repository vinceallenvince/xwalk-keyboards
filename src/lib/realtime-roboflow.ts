const REQUIRED_ENVIRONMENT_VARIABLES = [
  "ROBOFLOW_API_KEY",
  "ROBOFLOW_WORKSPACE",
  "ROBOFLOW_REALTIME_WORKFLOW_ID",
  "ROBOFLOW_IMAGE_INPUT",
  "ROBOFLOW_DATA_OUTPUT",
] as const;

export type RealtimeOutputBindings = {
  all: string;
};

export type RealtimeRoboflowConfiguration = {
  apiKey: string;
  classes: string;
  imageInput: string;
  outputBindings: RealtimeOutputBindings;
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
    },
    region: get("ROBOFLOW_WEBRTC_REGION") || "us",
    requestedPlan: get("ROBOFLOW_WEBRTC_PLAN") || "webrtc-gpu-medium",
    workflowId: get("ROBOFLOW_REALTIME_WORKFLOW_ID"),
    workspace: get("ROBOFLOW_WORKSPACE"),
  };
}
