#!/usr/bin/env bash
# Trigger the calibration agent and update the local fallback file.
#
# Usage:
#   pnpm recalibrate [path/to/frame.png] [cameraId]
#
# If no frame is given, uses the default test frame from the calibration agent
# repo. Requires gcloud auth (for the identity token to reach Cloud Run).

set -euo pipefail

AGENT_URL="${CALIBRATION_AGENT_URL:-https://xwalk-camera-calibration-agent-21826886868.us-central1.run.app}"
WEB_URL="${CALIBRATION_WEB_URL:-https://xwalk-keyboards-21826886868.us-central1.run.app}"
CAMERA_ID="${2:-5056}"
FALLBACK="public/calibration-fallback-${CAMERA_ID}.json"
DEFAULT_FRAME="../xwalk-camera-calibration-agent/images/videoframe_872991.png"

FRAME="${1:-$DEFAULT_FRAME}"
if [ ! -f "$FRAME" ]; then
  echo "Frame not found: $FRAME"
  echo "Usage: pnpm recalibrate [path/to/frame.png]"
  exit 1
fi

echo "→ Authenticating..."
TOKEN=$(gcloud auth print-identity-token 2>/dev/null) || {
  echo "Failed to get identity token. Run: gcloud auth login"
  exit 1
}

echo "→ Sending frame to calibration agent..."
HTTP=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "frame=@$FRAME" \
  -F "cameraId=$CAMERA_ID" \
  --max-time 300 \
  "$AGENT_URL/api/calibrate" \
  -o /tmp/recalibrate-result.json \
  -w "%{http_code}")

if [ "$HTTP" != "200" ]; then
  echo "Agent returned HTTP $HTTP"
  cat /tmp/recalibrate-result.json 2>/dev/null
  exit 1
fi

python3 -c "
import json
d = json.load(open('/tmp/recalibrate-result.json'))
print(f'  status    : {d[\"status\"]}')
print(f'  published : {d[\"published\"]}')
print(f'  stripes   : {len(d.get(\"stripes\") or [])}')
print(f'  reasoning : {d.get(\"reasoning\", \"\")!r}')
print(f'  createdAt : {d[\"createdAt\"][:19]}')
"

echo "→ Fetching updated calibration from GCS via web app..."
sleep 2  # GCS propagation
curl -s "$WEB_URL/api/calibration/$CAMERA_ID" > "$FALLBACK"

python3 -c "
import json
d = json.load(open('$FALLBACK'))
print(f'  Updated {\"$FALLBACK\"}: {len(d[\"stripes\"])} stripes, updatedAt={d[\"updatedAt\"][:19]}')
"

echo "✓ Done. Reload /realtime to pick up the new calibration."
