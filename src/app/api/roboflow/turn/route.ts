import { InferenceHTTPClient, WorkflowError } from "@roboflow/inference-sdk";
import { NextResponse } from "next/server";

import { readRealtimeRoboflowConfiguration } from "@/lib/realtime-roboflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const configuration = readRealtimeRoboflowConfiguration();
    const client = InferenceHTTPClient.init({ apiKey: configuration.apiKey });
    const iceServers = await client.fetchTurnConfig();
    return NextResponse.json({ iceServers: iceServers ?? [] }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof WorkflowError) {
      return NextResponse.json(error.errorData, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Unable to fetch TURN configuration";
    console.error("[Roboflow TURN]", message);
    return NextResponse.json({ message: "Unable to start Realtime inference" }, { status: 500 });
  }
}
