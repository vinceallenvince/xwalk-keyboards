import { adaptAndValidateCrosswalkScore, type CrosswalkBatchManifest, type CrosswalkScore } from "./crosswalk-score";

export async function requestCrosswalkScore(manifest: CrosswalkBatchManifest, composite: Blob): Promise<CrosswalkScore> {
  const body = new FormData();
  body.set("manifest", JSON.stringify(manifest));
  body.set("composite", composite, `${manifest.batchId}.jpg`);
  const response = await fetch("/api/score-batch", { body, cache: "no-store", method: "POST" });
  const payload = await response.json() as unknown;
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string" ? payload.message : `Agent scoring returned ${response.status}`;
    throw new Error(message);
  }
  const score = adaptAndValidateCrosswalkScore(payload, manifest);
  if (!score) throw new Error("Agent score did not satisfy the v3 batch contract");
  return score;
}
