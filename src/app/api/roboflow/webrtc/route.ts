import {
  InferenceHTTPClient,
  WorkflowError,
  type WebRTCOffer,
} from "@roboflow/inference-sdk";
import { NextResponse } from "next/server";

import {
  readRealtimeRoboflowConfiguration,
  scaledRealtimeCrosswalkPolygons,
} from "@/lib/realtime-roboflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebRTCProxyRequest = { offer?: WebRTCOffer };

function validFrameDimension(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 4096;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const frameWidth = Number(requestUrl.searchParams.get("frameWidth"));
  const frameHeight = Number(requestUrl.searchParams.get("frameHeight"));
  if (!validFrameDimension(frameWidth) || !validFrameDimension(frameHeight)) {
    return NextResponse.json({ message: "Valid WebRTC frame dimensions are required" }, { status: 400 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 250_000) {
    return NextResponse.json({ message: "WebRTC offer is too large" }, { status: 413 });
  }

  try {
    const body = await request.json() as WebRTCProxyRequest;
    const offer = body.offer;
    if (
      !offer ||
      typeof offer.type !== "string" ||
      typeof offer.sdp !== "string" ||
      offer.sdp.length === 0 ||
      offer.sdp.length > 200_000
    ) {
      return NextResponse.json({ message: "A valid WebRTC offer is required" }, { status: 400 });
    }

    const configuration = readRealtimeRoboflowConfiguration();
    const crosswalkPolygons = await scaledRealtimeCrosswalkPolygons({
      width: frameWidth,
      height: frameHeight,
    });
    const client = InferenceHTTPClient.init({ apiKey: configuration.apiKey });
    const answer = await client.initializeWebrtcWorker({
      offer,
      workspaceName: configuration.workspace,
      workflowId: configuration.workflowId,
      config: {
        imageInputName: configuration.imageInput,
        workflowsParameters: {
          classes: configuration.classes,
          [configuration.polygonInputs.left]: crosswalkPolygons.left,
          [configuration.polygonInputs.right]: crosswalkPolygons.right,
        },
        streamOutputNames: [],
        // Only request the 'all' output — client-side classification handles
        // inside/outside using the live calibration boundaries, so the
        // workflow's per-polygon outputs are no longer needed.
        dataOutputNames: [configuration.outputBindings.all],
        realtimeProcessing: true,
        requestedPlan: configuration.requestedPlan,
        requestedRegion: configuration.region,
        extraPayload: { use_cache: false },
      },
    });

    return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WorkflowError) {
      return NextResponse.json(error.errorData, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Unable to start WebRTC";
    console.error("[Roboflow WebRTC]", message);
    return NextResponse.json({ message: "Unable to start Realtime inference" }, { status: 500 });
  }
}
