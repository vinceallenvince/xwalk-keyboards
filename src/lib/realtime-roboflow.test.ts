import { describe, expect, it } from "vitest";

import {
  missingRealtimeRoboflowConfiguration,
  readRealtimeRoboflowConfiguration,
} from "./realtime-roboflow";

const configuredEnvironment = {
  ROBOFLOW_API_KEY: "server-only",
  ROBOFLOW_WORKSPACE: "workspace",
  ROBOFLOW_REALTIME_WORKFLOW_ID: "workflow",
  ROBOFLOW_IMAGE_INPUT: "image",
  ROBOFLOW_DATA_OUTPUT: "all",
};

describe("Realtime Roboflow configuration", () => {
  it("keeps credentials server-side while returning named bindings", () => {
    const configuration = readRealtimeRoboflowConfiguration(configuredEnvironment);
    expect(configuration.outputBindings).toEqual({ all: "all" });
    expect(missingRealtimeRoboflowConfiguration(configuredEnvironment)).toEqual([]);
  });

  it("reports every missing required variable", () => {
    expect(missingRealtimeRoboflowConfiguration({})).toEqual([
      "ROBOFLOW_API_KEY",
      "ROBOFLOW_WORKSPACE",
      "ROBOFLOW_REALTIME_WORKFLOW_ID",
      "ROBOFLOW_IMAGE_INPUT",
      "ROBOFLOW_DATA_OUTPUT",
    ]);
  });

  it("applies defaults for the optional variables", () => {
    const configuration = readRealtimeRoboflowConfiguration(configuredEnvironment);
    expect(configuration.classes).toBe("person");
    expect(configuration.region).toBe("us");
    expect(configuration.requestedPlan).toBe("webrtc-gpu-medium");
  });
});
