import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Accepts a StartupSummary payload from the client and writes it as a
 * structured JSON log line to Cloud Run stdout. No database, no external
 * store — Cloud Logging picks up stdout automatically, and a log-based
 * metric or BigQuery export feeds the Looker Studio dashboard.
 *
 * The payload contains only durations, statuses, and counts — no PII,
 * no secrets, no image data.
 */

const MAX_BODY_BYTES = 2048;

const VALID_SESSION_TYPES = new Set(["initial", "retry", "stall-reconnect", "pause-continue"]);
const VALID_OUTCOMES = new Set(["success", "failed", "in-progress"]);
const VALID_MILESTONES = new Set([
  "page_mount",
  "attempt_start",
  "config_loaded",
  "video_playable",
  "gpu_ready",
  "first_predictions",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(body: unknown): { valid: true; payload: Record<string, unknown> } | { valid: false; reason: string } {
  if (!isRecord(body)) return { valid: false, reason: "body must be a JSON object" };

  if (!VALID_SESSION_TYPES.has(body.sessionType as string)) {
    return { valid: false, reason: "invalid sessionType" };
  }
  if (!VALID_OUTCOMES.has(body.outcome as string)) {
    return { valid: false, reason: "invalid outcome" };
  }
  if (typeof body.connectionKey !== "number" || !Number.isFinite(body.connectionKey)) {
    return { valid: false, reason: "connectionKey must be a finite number" };
  }
  if (typeof body.retryCount !== "number" || !Number.isFinite(body.retryCount)) {
    return { valid: false, reason: "retryCount must be a finite number" };
  }
  if (!VALID_MILESTONES.has(body.reachedStage as string)) {
    return { valid: false, reason: "invalid reachedStage" };
  }

  // Validate milestones object — every key must be a known milestone name
  // and every value must be a finite number.
  if (isRecord(body.milestones)) {
    for (const [key, value] of Object.entries(body.milestones)) {
      if (!VALID_MILESTONES.has(key)) return { valid: false, reason: `unknown milestone: ${key}` };
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { valid: false, reason: `milestone ${key} must be a finite number` };
      }
    }
  } else {
    return { valid: false, reason: "milestones must be an object" };
  }

  // Duration fields are nullable numbers.
  for (const field of ["timeToGpuReady", "timeToPredictions", "predictionLag", "perceivedLatency"] as const) {
    const v = body[field];
    if (v !== null && (typeof v !== "number" || !Number.isFinite(v))) {
      return { valid: false, reason: `${field} must be a finite number or null` };
    }
  }

  return { valid: true, payload: body };
}

export async function POST(request: Request) {
  // Enforce a small body size limit to prevent abuse.
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "payload too large" },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "payload too large" },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "invalid JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = validatePayload(body);
  if (!result.valid) {
    return NextResponse.json(
      { error: result.reason },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Write a structured JSON log line to stdout. Cloud Run forwards stdout to
  // Cloud Logging; the `severity` and `message` fields are recognized by the
  // structured logging agent. The full payload is nested under `startup` so
  // it can be queried in Cloud Logging / BigQuery without colliding with the
  // logging envelope fields.
  const logEntry = {
    severity: "INFO",
    message: `[xwalk] startup-telemetry: outcome=${result.payload.outcome} type=${result.payload.sessionType}`,
    startup: result.payload,
  };
  console.log(JSON.stringify(logEntry));

  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
