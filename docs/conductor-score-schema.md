# Conductor Score API Schema

This is the language-neutral contract between XWALK KEYBOARDS and the XWALK
Conductor Agent. It is derived from the working `crosswalk-agent` prototype.

The conductor agent owns runtime validation. Any contract change must update
this document, the web app, and the agent in the same change.

## Endpoint

```text
POST /api/score-batch
Content-Type: multipart/form-data
```

The browser calls the XWALK KEYBOARDS server-side proxy, which forwards the
request to the conductor agent with an application key. The browser never
receives agent credentials or calls Gemini directly.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `manifest` | JSON string | Yes | Immutable batch manifest, schema version `1` |
| `composite` | JPEG, PNG, or WebP | Yes | Browser-rendered 4 × 3 composite for that manifest |

The composite must be non-empty and no larger than 7 MB.

## Batch manifest: schema version 1

```json
{
  "schemaVersion": "1",
  "batchId": "batch-20260807170500000-1",
  "createdAt": "2026-08-07T17:05:00.000Z",
  "intervalSeconds": 5,
  "durationSeconds": 60,
  "cameras": [
    {
      "index": 0,
      "cameraId": 3256,
      "sourceCameraId": 3256,
      "gridPosition": "top-left",
      "intervalStartSeconds": 0,
      "predictionCount": 3,
      "sourceTimestamp": "2026-08-07T17:04:51.000Z"
    }
  ]
}
```

| Field | Constraint |
| --- | --- |
| `schemaVersion` | Literal `"1"` |
| `batchId` | Non-empty, unique frozen-batch identifier |
| `createdAt` | ISO-8601 timestamp string |
| `intervalSeconds` | Literal `5` |
| `durationSeconds` | Literal `60` |
| `cameras` | Exactly twelve entries |

Each camera entry contains:

| Field | Constraint | Meaning |
| --- | --- | --- |
| `index` | Integer 0–11 | Stable composite and event index |
| `cameraId` | Positive integer | Logical priority-grid camera ID |
| `sourceCameraId` | Positive integer | Actual source; may be a fallback camera |
| `gridPosition` | One of the positions below | Stable UI location |
| `intervalStartSeconds` | 0, 5, …, 55 | Five-second event start |
| `predictionCount` | Non-negative integer or `null` | Frozen Roboflow detection count |
| `sourceTimestamp` | String or `null` | Source image timestamp |

Camera entries must remain in this exact order:

| Index | Position | Interval |
| ---: | --- | --- |
| 0 | `top-left` | 0–5 s |
| 1 | `top-middle-left` | 5–10 s |
| 2 | `top-middle-right` | 10–15 s |
| 3 | `top-right` | 15–20 s |
| 4 | `middle-left` | 20–25 s |
| 5 | `middle-middle-left` | 25–30 s |
| 6 | `middle-middle-right` | 30–35 s |
| 7 | `middle-right` | 35–40 s |
| 8 | `bottom-left` | 40–45 s |
| 9 | `bottom-middle-left` | 45–50 s |
| 10 | `bottom-middle-right` | 50–55 s |
| 11 | `bottom-right` | 55–60 s |

## Score response: schema version 3

The agent returns declarative score data, never executable Tone.js code. The
web app owns Tone.js construction, scheduling, limiting, and disposal.

```json
{
  "schemaVersion": "3",
  "batchId": "batch-20260807170500000-1",
  "intervalSeconds": 5,
  "durationSeconds": 60,
  "source": "agent",
  "model": "gemini-2.5-flash",
  "musicDirection": {
    "title": "Midtown Glass",
    "description": "A restrained glassy score with brighter movement for groups.",
    "masterReverb": 0.22
  },
  "voices": [
    {
      "id": "glassy-fm",
      "instrument": "fmPoly",
      "preset": "glass",
      "effects": [{ "type": "reverb", "preset": "smallHall", "wet": 0.25 }]
    }
  ],
  "events": [
    {
      "index": 0,
      "intervalStartSeconds": 0,
      "cameraId": 3256,
      "gridPosition": "top-left",
      "occupancy": "occupied",
      "occupiedStripeIndexes": [0, 3, 5],
      "notes": ["C4", "F4", "Ab4"],
      "confidence": 0.86,
      "voiceId": "glassy-fm",
      "gesture": "ascending",
      "durationSeconds": 1.8,
      "velocity": 0.68,
      "pan": -0.75,
      "octaveShift": 0,
      "arpeggioSpacingSeconds": 0.18,
      "visual": {
        "presentation": "grid",
        "rationale": "A quiet opening interval that establishes the full ensemble."
      },
      "audioDescription": "A glassy ascending C, F, and Ab figure."
    }
  ]
}
```

### Score-level constraints

| Field | Constraint |
| --- | --- |
| `schemaVersion` | Literal `"3"` |
| `batchId` | Must exactly equal the request manifest `batchId` |
| `intervalSeconds`, `durationSeconds` | Literal `5` and `60` |
| `source` | `agent`, `fallback`, or `mock` |
| `musicDirection.masterReverb` | 0–0.4 |
| `voices` | One to four unique voice IDs |
| `events` | Exactly twelve events in manifest order |
| `fallbackReason` | Optional diagnostic string for fallback responses |

### Event-level constraints

| Field | Constraint |
| --- | --- |
| Identity fields | `index`, `cameraId`, `gridPosition`, and `intervalStartSeconds` exactly match the same manifest entry |
| `occupancy` | `none`, `occupied`, or `uncertain` |
| `occupiedStripeIndexes` | Unique integer indexes 0–20 |
| `notes` | Derived by app validation; never pitch source of truth |
| `confidence` | 0–1 |
| `voiceId` | References a declared voice |
| `gesture` | `chord`, `ascending`, `descending`, `pulse`, `swell`, `scatter`, or `rest` |
| `durationSeconds` | 0.1–4.5 |
| `velocity` | 0.1–0.85 |
| `pan` | -0.85–0.85 |
| `octaveShift` | -1, 0, or 1 |
| `arpeggioSpacingSeconds` | 0.05–0.5 |
| `visual` | Required visual direction for the same frozen image and five-second event. See **Visual direction** below. |

`none` and `uncertain` events must have empty stripe/note arrays and use the
`rest` gesture.

### Visual direction

Each event includes a bounded visual decision so the conductor can emphasize a
meaningful contrast in the sequence without generating presentation code.

```json
{
  "presentation": "hero",
  "rationale": "A dense crossing creates a visual and musical peak after a rest."
}
```

| Field | Constraint |
| --- | --- |
| `presentation` | Required enum: `"grid"` or `"hero"`. `grid` keeps the active camera in its assigned 3 × 4 tile. `hero` presents that exact active camera's frozen image edge to edge above the grid. |
| `rationale` | Required, non-empty short string (maximum 240 characters) that explains the musical or visual intent. It is metadata for review/debugging and does not control rendering. |

The visual direction cannot provide a URL, layout coordinates, opacity,
duration, CSS, JavaScript, or animation instructions. The browser owns all
transition mechanics and must synchronize the selected presentation with the
event's existing `batchId`, camera, image, and five-second interval.

## Musical allowlist

| Instrument | Allowed presets |
| --- | --- |
| `fmPoly` | `glass`, `bell`, `electric`, `hollow` |
| `amPoly` | `warm`, `soft`, `nasal`, `distant` |
| `synthPoly` | `round`, `bright`, `dark`, `pad` |
| `pluck` | `dry`, `wood`, `soft`, `resonant` |

| Effect | Allowed presets |
| --- | --- |
| `reverb` | `room`, `smallHall`, `longHall` |
| `pingPongDelay` | `subtle`, `dotted`, `wide` |
| `chorus` | `slow`, `shimmer` |
| `filter` | `dark`, `warm`, `bright` |
| `tremolo` | `slow`, `pulse` |
| `distortion` | `soft`, `grit` |

Each voice allows at most three effects; each effect wet level is 0–0.4. The
web app must apply its own master limiter and safe polyphony/gain limits.

## Pitch derivation

The agent determines occupied stripe indexes. The app derives pitches using C
harmonic minor and the event's `octaveShift`:

```text
0 -> C4, 1 -> D4, 2 -> Eb4, 3 -> F4, 4 -> G4, 5 -> Ab4, 6 -> B4, 7 -> C5 …
```

## Validation and failure behavior

Both services validate the contract. Reject or normalize a mismatched batch,
wrong identity/order/timing, invalid range, duplicate event, unsupported
voice/effect, invalid stripe index, or occupancy inconsistent with notes.

The conductor makes one controlled retry for model failure. If no usable score
is available, it returns a schema-valid all-rest fallback score. At the app
level, the active batch is never replaced by a late, invalid, or mismatched
score; the prior valid batch and matching score replay at the loop boundary.

### Migration from schema version 2

Schema version 3 adds the required `event.visual` object. The production web
app and conductor service must migrate together: a version 2 response is not a
valid version 3 score unless a deliberate compatibility adapter supplies the
bounded visual field before validation.

## Change protocol

1. Update this reference and both repositories in the same change.
2. Add/refresh a shared request-response fixture.
3. Bump the schema version for a breaking change; never silently change `1` or
   `3` semantics.
