import {
  InferenceHTTPClient,
  WorkflowError,
  type WebRTCOffer,
} from "@roboflow/inference-sdk";
import { NextResponse } from "next/server";

import { readRealtimeRoboflowConfiguration } from "@/lib/realtime-roboflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebRTCProxyRequest = { offer?: WebRTCOffer };

export async function POST(request: Request) {
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
    const client = InferenceHTTPClient.init({ apiKey: configuration.apiKey });
    const answer = await client.initializeWebrtcWorker({
      offer,
      workspaceName: configuration.workspace,
      workflowId: configuration.workflowId,
      config: {
        imageInputName: configuration.imageInput,
        // The workflow's polygon zone inputs are no longer sent: client-side
        // classification handles inside/outside using the live calibration
        // boundaries, so only the class filter parameter remains.
        workflowsParameters: {
          classes: configuration.classes,
        },
        streamOutputNames: [],
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
