const REQUIRED_ENVIRONMENT_VARIABLES = [
  "ROBOFLOW_API_KEY",
  "ROBOFLOW_WORKSPACE",
] as const;

type Environment = Record<string, string | undefined>;

export type SnapshotRoboflowConfiguration = {
  apiKey: string;
  classes: string;
  classesInput: string;
  imageInput: string;
  polygonInput: string;
  workflowId: string;
  workspace: string;
};

function valueFor(environment: Environment, preferred: string, compatibility: string) {
  return environment[preferred]?.trim() || environment[compatibility]?.trim();
}

export function missingSnapshotRoboflowConfiguration(environment: Environment = process.env) {
  const missing: string[] = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !environment[name]?.trim());
  if (!valueFor(environment, "ROBOFLOW_SNAPSHOT_WORKFLOW_ID", "ROBOFLOW_WORKFLOW_ID")) missing.push("ROBOFLOW_SNAPSHOT_WORKFLOW_ID");
  if (!valueFor(environment, "ROBOFLOW_SNAPSHOT_IMAGE_INPUT", "ROBOFLOW_IMAGE_INPUT")) missing.push("ROBOFLOW_SNAPSHOT_IMAGE_INPUT");
  if (!valueFor(environment, "ROBOFLOW_SNAPSHOT_POLYGON_INPUT", "ROBOFLOW_CROSSWALK_POLYGON_INPUT")) missing.push("ROBOFLOW_SNAPSHOT_POLYGON_INPUT");
  return missing;
}

export function readSnapshotRoboflowConfiguration(
  environment: Environment = process.env
): SnapshotRoboflowConfiguration {
  const missing = missingSnapshotRoboflowConfiguration(environment);
  if (missing.length > 0) {
    throw new Error(`Missing server configuration: ${missing.join(", ")}`);
  }

  const get = (name: string) => environment[name]?.trim() as string;
  return {
    apiKey: get("ROBOFLOW_API_KEY"),
    classes: get("ROBOFLOW_CLASSES") || "person",
    classesInput: environment.ROBOFLOW_SNAPSHOT_CLASSES_INPUT?.trim() || "classes",
    imageInput: valueFor(environment, "ROBOFLOW_SNAPSHOT_IMAGE_INPUT", "ROBOFLOW_IMAGE_INPUT") as string,
    polygonInput: valueFor(environment, "ROBOFLOW_SNAPSHOT_POLYGON_INPUT", "ROBOFLOW_CROSSWALK_POLYGON_INPUT") as string,
    workflowId: valueFor(environment, "ROBOFLOW_SNAPSHOT_WORKFLOW_ID", "ROBOFLOW_WORKFLOW_ID") as string,
    workspace: get("ROBOFLOW_WORKSPACE"),
  };
}

export function snapshotWorkflowEndpoint(configuration: Pick<SnapshotRoboflowConfiguration, "workspace" | "workflowId">) {
  return `https://serverless.roboflow.com/${encodeURIComponent(configuration.workspace)}/workflows/${encodeURIComponent(configuration.workflowId)}`;
}
