import { describe, expect, it } from "vitest";

import {
  missingRealtimeRoboflowConfiguration,
  readRealtimeRoboflowConfiguration,
  scaledRealtimeCrosswalkPolygons,
} from "./realtime-roboflow";

const configuredEnvironment = {
  ROBOFLOW_API_KEY: "server-only",
  ROBOFLOW_WORKSPACE: "workspace",
  ROBOFLOW_REALTIME_WORKFLOW_ID: "workflow",
  ROBOFLOW_IMAGE_INPUT: "image",
  ROBOFLOW_DATA_OUTPUT: "all",
  ROBOFLOW_WEBRTC_INSIDE_LEFT_OUTPUT: "insideLeft",
  ROBOFLOW_WEBRTC_INSIDE_RIGHT_OUTPUT: "insideRight",
  ROBOFLOW_WEBRTC_OUTSIDE_OUTPUT: "outside",
  ROBOFLOW_WEBRTC_LEFT_POLYGON_INPUT: "leftPolygon",
  ROBOFLOW_WEBRTC_RIGHT_POLYGON_INPUT: "rightPolygon",
};

describe("Realtime Roboflow configuration", () => {
  it("keeps credentials server-side while returning named bindings", () => {
    const configuration = readRealtimeRoboflowConfiguration(configuredEnvironment);
    expect(configuration.outputBindings).toEqual({
      all: "all", insideLeft: "insideLeft", insideRight: "insideRight", outside: "outside",
    });
    expect(missingRealtimeRoboflowConfiguration(configuredEnvironment)).toEqual([]);
  });

  it("scales the View 5056 crosswalks to the WebRTC input", () => {
    const polygons = scaledRealtimeCrosswalkPolygons({ width: 704, height: 480 });
    expect(polygons.left[0]).toEqual([54, 216]);
    expect(polygons.right.at(-1)).toEqual([602, 300]);
  });
});
