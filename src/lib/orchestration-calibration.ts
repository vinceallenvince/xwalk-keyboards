import sourceCalibration from "../../docs/calibrations/priority-crosswalk-polygons.json";

type PolygonPoint = readonly [number, number];
type Polygon = readonly PolygonPoint[];
type ReferenceFrame = { width: number; height: number };

type CalibrationDocument = {
  referenceFrame: ReferenceFrame;
  [cameraKey: string]: ReferenceFrame | Polygon;
};

const calibration = sourceCalibration as unknown as CalibrationDocument;

export type StaticFrameSize = ReferenceFrame;

function isValidFrame(frame: StaticFrameSize) {
  return Number.isInteger(frame.width) && Number.isInteger(frame.height) && frame.width > 0 && frame.height > 0;
}

export function staticCrosswalkPolygon(cameraId: number, targetFrame: StaticFrameSize): Polygon | null {
  if (!Number.isSafeInteger(cameraId) || !isValidFrame(targetFrame)) return null;
  const sourcePolygon = calibration[`camera_${cameraId}`];
  if (!Array.isArray(sourcePolygon) || sourcePolygon.length < 3) return null;

  return sourcePolygon.map(([x, y]) => [
    Math.round(x * targetFrame.width / calibration.referenceFrame.width),
    Math.round(y * targetFrame.height / calibration.referenceFrame.height),
  ] as PolygonPoint);
}

export function hasStaticCrosswalkCalibration(cameraId: number) {
  return staticCrosswalkPolygon(cameraId, calibration.referenceFrame) !== null;
}
