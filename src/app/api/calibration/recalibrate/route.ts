import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AGENT_URL = process.env.CALIBRATION_AGENT_URL
  ?? "https://xwalk-camera-calibration-agent-21826886868.us-central1.run.app";

// API key for the calibration agent — used in local dev where the GCE
// metadata server isn't available for identity tokens.
const AGENT_API_KEY = process.env.CALIBRATION_AGENT_API_KEY;

/**
 * POST /api/calibration/recalibrate
 *
 * Triggers an on-demand calibration run. The browser captures a frame from the
 * live video, sends it here, and this route forwards it to the calibration
 * agent on Cloud Run (which requires an identity token, so the browser cannot
 * call it directly).
 *
 * Returns the agent's full response, which includes the updated stripes,
 * boundaries, status, and reasoning.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const frame = formData.get("frame");
  if (!frame || !(frame instanceof Blob)) {
    return new Response("Missing frame", { status: 400 });
  }

  // Get an identity token for the calibration agent service.
  let idToken: string | null = null;
  try {
    const tokenUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${AGENT_URL}`;
    const tokenResp = await fetch(tokenUrl, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(2_000),
    });
    if (tokenResp.ok) idToken = await tokenResp.text();
  } catch {
    // Running locally — agent may be unauthenticated or unreachable.
  }

  const agentForm = new FormData();
  agentForm.set("frame", frame, "frame.png");
  // Forward the camera identity so the agent calibrates (and publishes for)
  // the camera the browser is actually looking at, not its default.
  const cameraId = formData.get("cameraId");
  if (typeof cameraId === "string" && Number.isSafeInteger(Number(cameraId))) {
    agentForm.set("cameraId", cameraId);
  }

  const headers: Record<string, string> = {};
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  } else if (AGENT_API_KEY) {
    // Local dev fallback: the GCE metadata server is unavailable, so use
    // the agent's own API key instead of a Cloud Run identity token.
    headers["x-api-key"] = AGENT_API_KEY;
  }

  try {
    const agentResp = await fetch(`${AGENT_URL}/api/calibrate`, {
      method: "POST",
      headers,
      body: agentForm,
      signal: AbortSignal.timeout(60_000),
    });

    if (!agentResp.ok) {
      const text = await agentResp.text();
      return new Response(text, { status: agentResp.status });
    }

    const result = await agentResp.text();
    return new Response(result, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Calibration agent unavailable", { status: 502 });
  }
}
