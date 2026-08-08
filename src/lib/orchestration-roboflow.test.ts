import { describe, expect, it } from "vitest";

import {
  missingSnapshotRoboflowConfiguration,
  readSnapshotRoboflowConfiguration,
  snapshotWorkflowEndpoint,
} from "./orchestration-roboflow";

const configuredEnvironment = {
  ROBOFLOW_API_KEY: "server-only",
  ROBOFLOW_WORKSPACE: "workspace",
  ROBOFLOW_SNAPSHOT_WORKFLOW_ID: "snapshot-workflow",
  ROBOFLOW_SNAPSHOT_IMAGE_INPUT: "image",
  ROBOFLOW_SNAPSHOT_POLYGON_INPUT: "crosswalk_polygon",
  ROBOFLOW_SNAPSHOT_CLASSES_INPUT: "classes",
};

describe("Snapshot Roboflow configuration", () => {
  it("requires only server-side settings and keeps input names configurable", () => {
    const configuration = readSnapshotRoboflowConfiguration(configuredEnvironment);
    expect(missingSnapshotRoboflowConfiguration(configuredEnvironment)).toEqual([]);
    expect(configuration).toMatchObject({ imageInput: "image", polygonInput: "crosswalk_polygon" });
  });

  it("builds the documented serverless workflow endpoint", () => {
    expect(snapshotWorkflowEndpoint(readSnapshotRoboflowConfiguration(configuredEnvironment)))
      .toBe("https://serverless.roboflow.com/workspace/workflows/snapshot-workflow");
  });

  it("accepts the existing generic server-only names during the local transition", () => {
    const genericConfiguration = readSnapshotRoboflowConfiguration({
      ROBOFLOW_API_KEY: "server-only",
      ROBOFLOW_WORKSPACE: "workspace",
      ROBOFLOW_WORKFLOW_ID: "snapshot-workflow",
      ROBOFLOW_IMAGE_INPUT: "image",
      ROBOFLOW_CROSSWALK_POLYGON_INPUT: "crosswalk_polygon",
      ROBOFLOW_CLASSES: "person",
    });
    expect(genericConfiguration).toMatchObject({
      workflowId: "snapshot-workflow",
      imageInput: "image",
      polygonInput: "crosswalk_polygon",
      classesInput: "classes",
    });
  });
});
