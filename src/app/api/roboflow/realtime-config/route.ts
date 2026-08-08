import { NextResponse } from "next/server";

import {
  missingRealtimeRoboflowConfiguration,
  readRealtimeRoboflowConfiguration,
} from "@/lib/realtime-roboflow";

export const dynamic = "force-dynamic";

export async function GET() {
  const missing = missingRealtimeRoboflowConfiguration();
  if (missing.length > 0) {
    return NextResponse.json({
      available: false,
      message: "Realtime inference is not configured on this server.",
    });
  }

  const configuration = readRealtimeRoboflowConfiguration();
  return NextResponse.json({
    available: true,
    outputBindings: configuration.outputBindings,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
