import { NextResponse } from "next/server";

import { adaptAndValidateCrosswalkScore, parseCrosswalkBatchManifest } from "@/lib/crosswalk-score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_COMPOSITE_BYTES = 7 * 1024 * 1024;

function requiredEnvironment(name: "CROSSWALK_AGENT_URL" | "CROSSWALK_AGENT_API_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const manifestText = formData.get("manifest");
    const composite = formData.get("composite");
    if (typeof manifestText !== "string" || !(composite instanceof File)) return NextResponse.json({ message: "manifest and composite multipart fields are required" }, { status: 400 });
    if (!composite.type.startsWith("image/") || composite.size === 0 || composite.size > MAX_COMPOSITE_BYTES) return NextResponse.json({ message: "Composite must be an image between 1 byte and 7 MB" }, { status: 413 });
    const manifest = parseCrosswalkBatchManifest(JSON.parse(manifestText));
    if (!manifest) return NextResponse.json({ message: "Invalid batch manifest" }, { status: 422 });

    const upstreamForm = new FormData();
    upstreamForm.set("manifest", JSON.stringify(manifest));
    upstreamForm.set("composite", composite, `${manifest.batchId}.jpg`);
    const baseUrl = requiredEnvironment("CROSSWALK_AGENT_URL").replace(/\/$/, "");
    const upstream = await fetch(`${baseUrl}/api/score-batch`, {
      body: upstreamForm,
      cache: "no-store",
      headers: { "X-Crosswalk-Agent-Key": requiredEnvironment("CROSSWALK_AGENT_API_KEY") },
      method: "POST",
      signal: AbortSignal.timeout(110_000),
    });
    const payload = await upstream.json() as unknown;
    if (!upstream.ok) {
      const message = typeof payload === "object" && payload && "detail" in payload && typeof payload.detail === "string" ? payload.detail : `Crosswalk agent returned HTTP ${upstream.status}`;
      return NextResponse.json({ message }, { status: upstream.status });
    }
    const score = adaptAndValidateCrosswalkScore(payload, manifest);
    if (!score) return NextResponse.json({ message: "Crosswalk agent returned an invalid v3 score" }, { status: 502 });
    return NextResponse.json(score, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to score camera batch";
    console.error("[Crosswalk score]", message);
    return NextResponse.json({ message: "Unable to score camera batch" }, { status: 500 });
  }
}
