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

## Approach: a reasoning VLM as the primary calibration engine

A high-reasoning multimodal model (Gemini Pro class) is given the current frame
and asked to relocate the crosswalk polygons and the segmented white stripes.
This has been tried by hand and works.

It is a good fit for this specific problem. Painted white stripes on dark
asphalt are close to an ideal grounding target: high contrast, regular repeating
structure, crisp boundaries. And it brings two things that pure geometric
registration structurally cannot:

- **An explanation, not just a number.** Image registration yields a single
  confidence scalar. Snow over the stripes, a truck parked on the left
  crosswalk, night glare on wet asphalt, and a physical re-aim all collapse into
  "low confidence" — indistinguishable. A reasoning model can name which one it
  is, which is exactly what the status field needs to be useful.
- **Self-healing on re-aim.** Registration against a fixed reference fails
  hardest precisely when it matters most: a large re-aim breaks feature matching
  and needs a human to re-author. Detection simply re-detects.

There is also a failure mode registration cannot see at all. It assumes the only
thing that changed is camera pose, so if the crosswalk is repainted or the
intersection is reconfigured, it will keep faithfully transforming a stale ground
truth forever. Detection notices.

## The one thing that must be protected: the musical contract

Realtime's calibration is not two polygons. It is 25 individually ordered
stripes, each bound to a specific note from C4 to C6, split across two crosswalk
segments with an unplayable median and seam ownership defined by midpoints
between neighbouring stripes.

If a run returns 25 stripes and the next returns 24 — one occluded by a truck,
one faded past recognition — and the client re-enumerates them left to right,
every note shifts. The instrument silently transposes. This is the single
failure mode that matters most, because it is inaudible as a bug: it just sounds
wrong.

The fix is to make it a **relocation task, not a discovery task**:

- The reference calibration is passed in as context on every run. It defines how
  many stripes exist, their order, their segment, and their note bindings.
- The model returns each stripe **keyed by its reference `stripeIndex` and
  `segment`**, never as a fresh left-to-right enumeration.
- A stripe it cannot see returns `null` geometry with a reason — it is never
  dropped from the array, and never silently renumbered.
- The client keeps the note binding from the reference and takes only coordinates
  from the run.

So: **the reference owns the musical contract; the model owns the geometry.**

A strong grounding aid here is to pass the model *both* the reference frame with
the current polygons drawn on it *and* the new frame, and ask it to adjust them.
"Here is where these were, here is the new view, move them" is a much better
conditioned task than asking cold, and it improves run-to-run consistency
substantially.

## Output contract

Structured JSON output, schema-validated, rejected wholesale on any violation:

```jsonc
{
  "cameraId": 5056,
  "frameSize": { "width": 352, "height": 240 },
  "leftCrosswalk":  [[x, y], ...] | null,
  "rightCrosswalk": [[x, y], ...] | null,
  "stripes": [
    { "stripeIndex": 1, "segment": "left", "polygon": [[x, y], ...], "visible": true },
    { "stripeIndex": 2, "segment": "left", "polygon": null, "visible": false,
      "reason": "occluded by stopped truck" }
    // ... always all 25, always in reference order
  ],
  "conditions": {
    "crosswalkVisible": true,
    "obstruction": "none" | "snow" | "vehicle" | "construction" | "glare" | "darkness",
    "cameraMoved": "none" | "slight" | "significant",
    "repaintSuspected": false
  },
  "confidence": 0.0,
  "reasoning": "why this geometry and this status — max 250 chars"
}
```

`reasoning` and `conditions` are what make the status field genuinely
informative rather than a shrug. `reasoning` is capped at **250 characters** —
long enough for "left crosswalk stripes 1-6 obscured by snow; right crosswalk
clear and unmoved", short enough to sit in an operator table or a HUD advisory
without wrapping into an essay. Ask for the limit in the prompt *and* enforce it
on ingest: truncate rather than reject, since an over-long explanation should
never be the reason a good calibration is thrown away.

## Consistency, jitter, and hallucination

These are the real costs of a generative source, and they need explicit
handling. None are dealbreakers; all need to be designed for.

- **Jitter.** Two runs on near-identical frames may return slightly different
  coordinates. The stripes are narrow, so a few pixels of wobble changes which
  stripe a foot-point lands in near a seam. Mitigate with **hysteresis**: only
  publish when the new geometry differs from the live one by more than a
  threshold. A stable camera should produce zero publishes, not 96 tiny ones a
  day.
- **Self-consistency sampling.** Because it is generative, you can sample N times
  (or across the last N frames) and take a per-vertex median, discarding
  outliers. This is an advantage registration does not have and cannot offer,
  and it directly attacks both jitter and one-off hallucination.
- **Precision at the horizon.** Perspective makes far stripes only a few pixels
  wide. Coordinate precision will degrade there more than in the foreground.
  Measure this specifically in evaluation rather than assuming it is uniform.
- **Plausible-but-wrong output.** A VLM can return well-formed, confident,
  incorrect polygons. This is what the validation gates below exist for, and it
  is why gates matter *more* here than they would for a geometric method.

## Optional: geometric registration as a cheap cross-check

Not the primary engine, but worth considering later as corroboration. A
homography estimated between the reference frame and the current frame costs CPU
milliseconds and no API call. Running it alongside gives:

- **A second opinion.** If the model's polygons and the transformed reference
  agree within tolerance, confidence is high and the run can auto-publish. If
  they disagree, something interesting happened — flag it.
- **A numeric drift magnitude** for telemetry, independent of the model's own
  self-assessment.
- **A fallback** when the model API is unavailable or rate-limited.

Cheap enough to be worth it, but purely additive — defer to Phase 3 and drop it
if it is not earning its keep.

## Plan

### Phase 1 — Detect and disclose (ship this alone first)

Phase 1 deliberately does **not** auto-correct. It makes the failure legible,
which removes most of the user-visible harm, and it produces the labelled data
needed to trust Phase 2.

- Cloud Scheduler → Cloud Run **job** (not a long-lived service), every 15 min.
- Pull one current frame. Note that View `5056` is HLS-only with no static
  snapshot URL, so this means fetching a segment and decoding a frame (ffmpeg),
  not a simple image GET.
- Cheap checks before spending a model call:
  - **Feed down** — request failure, or bytes matching a known 511NY outage
    signature. Reuse `src/lib/camera-maintenance.ts`, which already fingerprints
    "camera being serviced" and "no live camera feed" images by SHA-256.
- Model call returns geometry + `conditions` + `reasoning` + `confidence`.
- Store the result **alongside the unmodified live calibration** — record what it
  would have done, do not apply it.
- Client fetches calibration + status and renders honestly.
- Archive every frame and every response. This is the evaluation set.

At the end of Phase 1 the app stops looking broken: when calibration is stale it
says so, instead of presenting a silent instrument.

### Phase 2 — Auto-correct, with rails

Only after the Phase 1 archive shows the model is reliable across conditions
(see Evaluation).

- Publish transformed polygons when **every** gate passes; otherwise retain
  last-known-good and set a degraded status.
- Publish atomically: write a new version, then flip a pointer. Never mutate the
  live row in place.
- Keep last-known-good and support one-command rollback.
- Apply hysteresis so a stable camera produces no churn.

### Phase 3 — Refinements, if warranted

- Geometric cross-check (above).
- Extend to the twelve Orchestration snapshot cameras, which drift too. Design
  the schema per-camera from day one so this is a no-op.
- Condition-aware cadence — check more often after detecting `slight` movement,
  back off when stable.

## Evaluation (gate on this before Phase 2)

The Phase 1 archive makes this straightforward, and it should not be skipped:

- Hand-label a held-out set of frames spanning day, night, rain, snow, heavy
  traffic, and at least one real re-aim.
- Measure **per-stripe coordinate error**, reported separately for near-field and
  horizon stripes.
- Measure **count and index stability**: how often does a visible stripe get
  reported missing, or vice versa?
- Measure **run-to-run variance** on consecutive near-identical frames — this
  sets the hysteresis threshold.
- Measure **status precision**: when it says `no_crosswalk`, is it right?

## Data model

One current document per camera, plus history. Firestore is the recommended
store — this is a single small JSON document per camera, written at most a few
times a day after hysteresis and read on page load. There are no joins and no
queries beyond "get camera X", so Cloud SQL's always-on instance plus a VPC
connector or Auth Proxy from Cloud Run is real cost and operational surface for
a key-value read. A GCS object is an even simpler alternative, and object
versioning gives history and rollback for free. Revisit Cloud SQL if calibration
becomes genuinely relational — an admin UI querying across many cameras, joins
against incident records.

```
calibrations/camera_5056
  status            : ok | degraded | no_crosswalk | feed_down | needs_review
  reasoning         : the model's explanation for the detection and the status,
                      max 250 chars, surfaced to operators
  conditions        : { crosswalkVisible, obstruction, cameraMoved, repaintSuspected }
  updatedAt         : timestamp
  referenceFrame    : { width, height }
  leftCrosswalk     : [[x, y], ...]
  rightCrosswalk    : [[x, y], ...]
  stripes           : [{ stripeIndex, segment, note, polygon }, ...]   // note from reference
  confidence        : number
  sourceRunId       : id of the agent run that produced this
  lastGoodAt        : timestamp of the last fully-validated calibration

calibrations/camera_5056/history/<runId>
  ... same shape plus the raw model response, for audit and rollback
```

The browser never talks to the store directly — reads go through a same-origin
Next.js route, consistent with the existing "no secrets in the browser"
boundary.

## Validation gates

A bad auto-calibration is worse than a stale one: it breaks the instrument
silently and with confidence. Nothing publishes unless **all** hold:

- Exactly 25 stripes present, with reference indices and segments intact.
- Visible-stripe count above a floor — if the model can only see 9 of 25, that is
  a `degraded` run, not a calibration.
- Stripe order monotonic along the crosswalk axis; left/right segments do not
  cross the median.
- Every polygon within frame bounds, non-degenerate, non-self-intersecting.
- Polygon areas within ±X% of reference.
- Total displacement below a re-aim cap. Larger is not drift — it is a camera
  that was physically re-pointed, and it goes to `needs_review`, not auto-apply.
- Change exceeds the hysteresis threshold, or nothing is published at all.

## Status model and client behaviour

| Status | Meaning | Client |
| --- | --- | --- |
| `ok` | Fresh, validated | Normal operation |
| `degraded` | Serving last-known-good; obstruction or low confidence | Run normally, quiet advisory in the HUD |
| `no_crosswalk` | Camera re-aimed or fully obstructed | Do not pretend; explain the study is unavailable |
| `feed_down` | Source outage | Existing feed-unavailable treatment |
| `needs_review` | Large change awaiting human approval | Serve last-known-good, advisory |

`reasoning` travels with the status, so an operator sees "stripes covered by
snow" rather than "confidence 0.42".

This slots into the Realtime status bar that already carries independent feed and
inference states, either as a third signal or folded into the feed line. The
existing rule holds: never imply the instrument is working when it is not.

## Delivering the fix to the client

Two gaps worth designing for now:

- **Long-lived sessions.** The Realtime page is meant to be left open. A session
  opened at 09:00 keeps its 09:00 calibration all day and never receives the
  correction. The client should re-fetch periodically (5–15 min) and hot-swap.
- **Roboflow binds the crosswalk polygons at session start.**
  `/api/roboflow/webrtc` passes `crosswalk_left_polygon` / `crosswalk_right_polygon`
  when the workflow is initialised. Stripe polygons are client-side and hot-swap
  for free; the inside/outside polygons do not. Recalibrating mid-session means
  either restarting inference (a visible gap) or **moving inside/outside
  classification to the client** — the workflow returns all `person` detections
  and the browser tests them against the current polygons.

  The second option is worth serious consideration: calibration becomes purely
  client-side data, hot-swappable with no reconnect, the Roboflow workflow
  simplifies to plain person detection, and the polygon-scaling round-trip drops
  out of the WebRTC init path.

## Open decisions

1. **Inside/outside classification**: keep it server-side in the Roboflow
   workflow, or move it client-side. This meaningfully shapes Phase 2.
2. **Auto-apply threshold**: how much drift may correct itself unattended before
   a human is asked.
3. **Model call budget**: 96 runs/day at high reasoning, plus any
   self-consistency sampling multiplier. Worth pricing explicitly before
   committing to the cadence.
4. **Whether Phase 2 is needed now.** Phase 1 plus a manual recalibration
   workflow removes the "looks broken" problem at a fraction of the cost and
   risk. Decide this deliberately rather than by default.

## Alternatives considered

- **Widen the polygons / add tolerance.** Dilate the crosswalk zones and lean on
  nearest-stripe seam assignment. Zero infrastructure, absorbs small drift.
  Rejected as the primary fix — a 5–6° tilt moves the crosswalk far more than
  tolerance can absorb, and widening degrades precision: people on the sidewalk
  start playing notes. Still worth doing as cheap insurance.
- **Geometric registration (homography) as primary.** Preserves stripe ordering
  by construction and is essentially free per run, but cannot explain itself,
  fails on the re-aims it most needs to survive, and silently transforms stale
  geometry if the crosswalk is ever repainted. Better used as an optional
  cross-check (Phase 3).
- **Detect-and-alert only, human redraws.** Phase 1 without Phase 2. Much lower
  risk and much less machinery. A legitimate end state, not merely a stepping
  stone.
- **Client-side calibration at session start.** Every viewer calibrates their own
  frame. Rejected: duplicates work per visitor, and gives different viewers
  different calibrations.
