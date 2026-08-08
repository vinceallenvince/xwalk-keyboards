import { NextResponse } from "next/server";

import { findStaticCamera } from "@/data/cameras";
import { staticCrosswalkPolygon } from "@/lib/orchestration-calibration";
import { normalizeSnapshotInferenceOutput } from "@/lib/orchestration-inference-output";
import {
  missingSnapshotRoboflowConfiguration,
  readSnapshotRoboflowConfiguration,
  snapshotWorkflowEndpoint,
} from "@/lib/orchestration-roboflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 2_000_000;

function jpegFrameSize(image: Buffer) {
  if (image[0] !== 0xff || image[1] !== 0xd8) return null;
  for (let offset = 2; offset + 8 < image.length;) {
    if (image[offset] !== 0xff) return null;
    const marker = image[offset + 1];
    const segmentLength = image.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > image.length) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: image.readUInt16BE(offset + 5), width: image.readUInt16BE(offset + 7) };
    }
    offset += segmentLength + 2;
  }
  return null;
}

function validCameraId(value: FormDataEntryValue | null) {
  const cameraId = Number(value);
  return Number.isSafeInteger(cameraId) ? cameraId : null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES + 10_000) {
    return NextResponse.json({ message: "Snapshot image is too large" }, { status: 413 });
  }

  const missing = missingSnapshotRoboflowConfiguration();
  if (missing.length > 0) {
    return NextResponse.json({ message: "Snapshot inference is not configured on this server." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Expected a snapshot form upload" }, { status: 400 });
  }

  const cameraId = validCameraId(formData.get("cameraId"));
  const image = formData.get("image");
  const camera = cameraId === null ? undefined : findStaticCamera(cameraId);
  if (!camera || !(image instanceof File) || !image.type.startsWith("image/") || image.size === 0) {
    return NextResponse.json({ message: "A valid static camera image is required" }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ message: "Snapshot image is too large" }, { status: 413 });
  }

  // The browser sends the logical grid slot's active source. An uncalibrated
  // camera (currently View 3230) is never allowed to reach Roboflow.
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const frame = jpegFrameSize(imageBuffer);
  if (!frame) {
    return NextResponse.json({ message: "Snapshot image must be a valid JPEG" }, { status: 400 });
  }
  const polygon = staticCrosswalkPolygon(camera.cameraId, frame);
  if (!polygon) {
    return NextResponse.json({ message: "This camera has no static crosswalk calibration." }, { status: 422 });
  }

  try {
    const configuration = readSnapshotRoboflowConfiguration();
    const imageData = `data:${image.type};base64,${imageBuffer.toString("base64")}`;
    const upstream = await fetch(snapshotWorkflowEndpoint(configuration), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        api_key: configuration.apiKey,
        inputs: {
          [configuration.imageInput]: imageData,
          [configuration.polygonInput]: polygon,
          [configuration.classesInput]: configuration.classes,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      console.error("[Roboflow snapshot]", upstream.status);
      return NextResponse.json({ message: "Snapshot inference failed" }, { status: 502 });
    }
    const output = normalizeSnapshotInferenceOutput(await upstream.json());
    if (!output) {
      console.error("[Roboflow snapshot] Unsupported workflow output");
      return NextResponse.json({ message: "Snapshot inference returned an unsupported result" }, { status: 502 });
    }
    return NextResponse.json({
      imageUrl: output.annotatedImageUrl,
      insideCount: output.insideCount,
      outsideCount: output.outsideCount,
      predictionCount: output.predictionCount,
    }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snapshot inference failed";
    console.error("[Roboflow snapshot]", message);
    return NextResponse.json({ message: "Snapshot inference failed" }, { status: 502 });
  }
}
