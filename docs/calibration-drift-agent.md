# Realtime Calibration Drift Agent

## Problem

The Realtime study's crosswalk polygons and stripe keyboard are calibrated by
hand against one reference frame of View `5056` and then baked into the client
(`src/lib/realtime-calibration.ts`). The physical camera does not hold still.
Wind, thermal expansion, and maintenance re-aims move it — a 5–6° downward tilt
over a day is enough to shift the crosswalk tens of pixels in frame space.

When that happens the app fails *silently and badly*: pedestrians walk the real
crosswalk, miss the drifted polygons, and nothing lights up or sounds. To a
visitor the instrument looks broken, and there is no signal anywhere that
calibration — rather than the camera or the GPU — is the thing at fault.

## Assessment of the proposed approach

The shape of the proposal is right and worth building:

- **Server-owned calibration, fetched by the client.** Correct. Calibration is
  operational data with its own lifecycle; baking it into the bundle means a
  redeploy for every drift correction.
- **A background agent on a fixed cadence.** Correct, and 15 minutes is a sane
  starting cadence.
- **A status field the client renders against.** Correct, and the highest-value
  part of the whole design — see "Phase 1" below.

Three changes I would make before building it.

### 1. "Redraws the polygons" should mean *re-registration*, not re-detection

This is the most important correction. There are two very different ways to
produce updated polygons:

- **Re-detect the crosswalk** in each new frame (a segmentation model, a
  Roboflow crosswalk class, or a VLM asked for coordinates) and rebuild the
  geometry from scratch.
- **Re-register the existing geometry**: compute the transform between the
  original reference frame and the current frame, then push the *already
  authored* polygons through it.

Re-detection is the wrong tool here, because Realtime's calibration is not two
polygons — it is 25 individually ordered stripes, each bound to a specific note
from C4 to C6, split across two crosswalk segments with an unplayable median
and seam ownership defined by midpoints between neighbouring stripes. A detector
that returns "the crosswalk" cannot be trusted to re-derive that same ordered
subdivision, with the same stripe count, in the same left-to-right order, every
15 minutes. A single off-by-one re-ordering silently transposes the instrument.

Re-registration has none of that risk. The crosswalk lies on the road plane, and
two views of a plane are related exactly by a homography — which is precisely
the case for a fixed camera that pans/tilts/rolls. So:

1. Keep the hand-authored reference calibration and its reference frame as the
   permanent source of truth.
2. Every run, grab a current frame and estimate the homography `H` from
   reference → current (ORB/SIFT feature matching + RANSAC, or ECC alignment for
   small motions; OpenCV, CPU, milliseconds).
3. Apply `H` to *every* calibrated point — both crosswalk polygons and all 25
   stripe polygons — in one coherent transform.

Stripe order, count, note bindings, and median all survive by construction,
because nothing is re-derived; the same points are simply moved. Road markings,
curbs, and lane lines give plenty of features to match on.

**Always register against the original reference, never against the previous
run's frame.** Chaining transforms accumulates error and lets the calibration
walk away over weeks.

Detection models and VLMs still have a job here — just not this one. They are
well suited to the *semantic* checks (is a crosswalk visible at all? is this a
maintenance placeholder?) where approximate answers are fine.

### 2. Cloud SQL is heavier than this workload needs

What is actually being stored is one small JSON document per camera, written
~96 times a day and read on page load. There are no joins, no transactions
across rows, and no queries beyond "get the current row for camera X". Cloud SQL
brings an always-on instance, connection pooling, and either a VPC connector or
the Auth Proxy from Cloud Run — real cost and real operational surface for a
key-value read.

Recommended instead, in order:

- **Firestore** — serverless, no connection management, native JSON documents,
  trivially cheap at this volume, and a natural fit for "current calibration per
  camera" plus a `history` subcollection. This is my recommendation.
- **A GCS object** (`calibration/camera_5056.json`) — even simpler, and object
  versioning gives you free history and one-command rollback. Good if you want
  the absolute minimum moving parts.

Cloud SQL earns its place if calibration becomes genuinely relational — an admin
UI with filtering across many cameras, joins against deployment or incident
records, reporting. Worth revisiting then; not now.

Either way the browser must not talk to the store directly. Reads go through a
same-origin Next.js route, consistent with the existing "no secrets in the
browser" boundary.

### 3. Fetch-on-load alone will not deliver the fix

Two gaps:

- **Long-lived sessions.** The Realtime page is designed to be left open. A
  session opened at 09:00 keeps its 09:00 calibration all day and never receives
  the correction. The client should re-fetch periodically (5–15 min) and
  hot-swap.
- **Roboflow binds the crosswalk polygons at session start.** `/api/roboflow/webrtc`
  passes `crosswalk_left_polygon` / `crosswalk_right_polygon` when the WebRTC
  workflow is initialised. Stripe polygons are client-side and hot-swap for
  free; the inside/outside polygons do not. Changing them mid-session means
  either restarting inference (a visible gap) or moving inside/outside
  classification to the client — having the workflow return all `person`
  detections and testing them against the current polygons in the browser.

  The second option is worth serious consideration: it makes calibration purely
  client-side data, hot-swappable with no reconnect, and simplifies the Roboflow
  workflow to plain person detection. It also removes the polygon-scaling
  round-trip from the WebRTC init path.

## Recommended plan

### Phase 1 — Detect and disclose (do this first, ship it alone)

Phase 1 deliberately does **not** auto-correct anything. It makes the failure
legible, which is most of the user-visible harm, and it produces the dataset
needed to trust Phase 2.

- Cloud Scheduler → Cloud Run **job** (not a long-lived service) every 15 min.
- The job pulls one current frame. Note that View `5056` is HLS-only with no
  static snapshot URL, so this means fetching a segment and decoding a frame
  (ffmpeg), not a simple image GET.
- Classify the frame:
  - **Feed down** — request failure, or bytes matching a known 511NY outage
    signature. Reuse `src/lib/camera-maintenance.ts`, which already fingerprints
    "camera being serviced" and "no live camera feed" images by SHA-256.
  - **No crosswalk in view** — a re-aim or obstruction. A VLM or detector call
    is appropriate here; approximate is fine.
  - **Drifted** — homography estimated, with a magnitude and a confidence.
  - **OK** — drift below threshold, high confidence.
- Write the result plus the *unmodified* current calibration to the store.
- Client fetches calibration + status and renders honestly (see status model).
- Log drift magnitude over time. This both validates Phase 2 offline and is a
  genuinely interesting artifact for the project — a chart of how much a NYC
  traffic camera wanders in a week.

At the end of Phase 1 the app stops looking broken: when calibration is stale it
says so, rather than presenting a silent instrument.

### Phase 2 — Auto-correct, with rails

Only after Phase 1 has produced enough history to check the homography offline
against hand-labelled frames.

- Apply `H` to the reference calibration and publish the transformed polygons.
- **Publish only if every gate passes** (see below); otherwise retain
  last-known-good and set a degraded status.
- Publish atomically: write a new version, then flip a pointer. Never mutate the
  live row in place.
- Keep last-known-good and support one-command rollback.

### Phase 3 — Refinements, if warranted

- Multiple reference frames per lighting condition (day/night/wet), matching
  against the best one; feature matching degrades at night and in heavy rain.
- Extend to the twelve Orchestration snapshot cameras, which drift too. Design
  the schema per-camera from day one so this is a no-op.
- Adaptive cadence (back off when stable). Probably not worth the complexity —
  96 runs a day is already negligible.

## Data model

One current document per camera, plus history. Sketch (Firestore):

```
calibrations/camera_5056
  status            : ok | degraded | no_crosswalk | feed_down | needs_review
  statusDetail      : short human-readable string
  updatedAt         : timestamp
  referenceFrame    : { width, height }
  leftCrosswalk     : [[x, y], ...]
  rightCrosswalk    : [[x, y], ...]
  stripes           : [{ stripeIndex, segment, note, polygon }, ...]
  drift             : { magnitudePx, rotationDeg, confidence, inlierRatio }
  sourceRunId       : id of the agent run that produced this
  lastGoodAt        : timestamp of the last fully-validated calibration

calibrations/camera_5056/history/<runId>
  ... same shape, one per publish, for audit and rollback
```

The stripe array keeps its authored order and note bindings verbatim; only
coordinates change.

## Validation gates

A bad auto-calibration is worse than a stale one, because it breaks the
instrument silently and with confidence. Nothing publishes unless **all** hold:

- Homography confidence above threshold (inlier ratio, reprojection error).
- Every transformed polygon stays within frame bounds.
- No polygon becomes self-intersecting or degenerate.
- Polygon areas stay within ±X% of the reference (a wild area change means the
  match found the wrong plane).
- Stripe order along the crosswalk axis is preserved, count unchanged, and the
  left/right segments do not cross the median.
- Total drift is below a re-aim cap. Anything larger is not drift — it is a
  camera that was physically re-pointed, and it goes to `needs_review` for a
  human, not to auto-apply.

## Status model and client behaviour

| Status | Meaning | Client |
| --- | --- | --- |
| `ok` | Fresh, validated | Normal operation |
| `degraded` | Serving last-known-good; drift suspected or confidence low | Run normally, quiet advisory in the HUD |
| `no_crosswalk` | Camera re-aimed or obstructed | Do not pretend; explain the study is unavailable |
| `feed_down` | Source outage | Existing feed-unavailable treatment |
| `needs_review` | Large change awaiting human approval | Serve last-known-good, advisory |

This slots into the Realtime status bar that already carries independent feed and
inference states, either as a third signal or folded into the feed line. The
existing rule holds: never imply the instrument is working when it is not.

## Open decisions

1. **Store**: Firestore (recommended) vs GCS object vs Cloud SQL as proposed.
2. **Inside/outside classification**: keep server-side in the Roboflow workflow
   (requires inference restart to recalibrate mid-session) or move client-side
   (hot-swappable, simpler workflow). This one meaningfully shapes Phase 2.
3. **Auto-apply threshold**: how much drift may correct itself unattended before
   a human is asked.
4. **Phase 1 alone may be enough for the current demo.** Honest status plus a
   manual recalibration workflow removes the "looks broken" problem at a
   fraction of the cost. Worth deciding explicitly whether Phase 2 is needed now.

## Alternatives considered

- **Widen the polygons / add tolerance.** Dilate the crosswalk zones and lean on
  nearest-stripe seam assignment. Zero infrastructure, and it absorbs small
  drift. Rejected as the primary fix: a 5–6° tilt moves the crosswalk far more
  than tolerance can absorb, and widening degrades precision — people on the
  sidewalk start playing notes. Still worth doing as cheap insurance.
- **Detect-and-alert only, human redraws.** Phase 1 without Phase 2. Much lower
  risk and much less machinery. A legitimate end state, not just a stepping
  stone.
- **Client-side calibration at session start.** Every viewer registers their own
  frame. Rejected: duplicates the same work per visitor, puts CV in the browser,
  and gives different viewers different calibrations.
- **Re-detect geometry from scratch each run.** Rejected for the stripe-ordering
  reasons above; retained only as a validation signal.
