# XWALK KEYBOARDS Hackathon Implementation Plan

## Goal

Deliver a reliable, deployed demonstration in approximately four hours. The
priority is a compelling **Realtime** study. The **Orchestration** study is a
second, independently demoable experience; the homepage and documentation
should not delay either study.

This is a demo-first plan. A completed milestone is deployed to Cloud Run,
checked in a normal browser, and committed before work begins on the next one.
The detailed target architecture remains in [architecture.md](architecture.md)
and deployment commands/configuration in [deployment.md](deployment.md).

## Delivery principles

1. **Deploy early.** Use the first deployable camera registry as the proof that
   the Next.js shell, Cloud Run configuration, secrets, and public URL work.
2. **Protect the Realtime study.** Do not start Orchestration until Realtime
   has been reviewed at its deployed URL and its core interaction is sound.
3. **Reuse the prototype paths.** Port the tested HLS display, Roboflow
   workflow integration, calibration, and audio logic from `511NY-test`; do
   not redesign those integration points during the event.
4. **Prefer deterministic degradation.** A static image, a rest, a prior valid
   batch, or a `grid` visual direction is better than a blank page or a broken
   performance.
5. **Treat polish as time-boxed.** The homepage and nonessential visual
   effects come after both studies have a demo-safe baseline.

## Canonical hackathon camera set

During the hackathon, seed XWALK KEYBOARDS from the already curated registry in
[`511NY-test/src/data/camera.ts`](../../511NY-test/src/data/camera.ts). Copy
that data into this repository as its own source-controlled registry; do not
create a runtime dependency on the prototype repository.

| Use | Ordered 511NY view IDs |
| --- | --- |
| Orchestration priority cameras | `3256`, `3494`, `3257`, `3326`, `3355`, `3259`, `3282`, `3242`, `3431`, `3456`, `3414`, `3395` |
| Orchestration fallback cameras | `3107`, `3231`, `3230`, `3245` |
| Realtime study and homepage background | `5056` — West Street at W. 34 St |

View `5056` is the identifier used in the 511NY camera URL, calibration files,
and new app registry: `https://511ny.org/map/Cctv/5056`. It is currently
enabled as **West Street at W. 34 St**, with HLS URL
`https://s9.nysdot.skyvdn.com:443/rtplive/R11_272/playlist.m3u8`. The 511NY
camera API records its camera ID as `910` and Skyline source ID as `16090`.
Treat those as source metadata only; use `5056` as the product-facing camera
and calibration ID.

## Milestone overview

| Milestone | Target time | Outcome | Demo-safe definition |
| --- | ---: | --- | --- |
| 0. Foundation | 0:00–0:20 | App scaffold and Cloud Run path configured | A minimal page builds and is deployable in `xwalk-keyboards-01`. |
| 1. Camera Registry | 0:20–0:55 | Deployed registry of priority, fallback, and live cameras | Every configured camera renders one snapshot or an explicit unavailable state, with its direct 511NY link. |
| 2. Realtime study | 0:55–2:25 | Deployed live West Street at W. 34 St crosswalk instrument | HLS video, pedestrian inference, calibrated stripe glow, and browser piano audio work together. |
| 3. Orchestration study | 2:25–3:25 | Deployed twelve-camera five-second performance | A queued/frozen 12-image batch cycles reliably with basic audio and visual state. |
| 4. Homepage | 3:25–3:40 | Designed entry and navigation | Homepage links reliably to both studies and the registry. |
| 5. Documentation and handoff | 3:40–4:00 | Submission-ready repository and diagram | README(s), deployment record, and FigJam system diagram communicate the working demo. |

Keep the final five minutes of each milestone for deployment verification and
a commit. If a milestone runs late, take its cut line rather than borrowing
time from Realtime verification or the final handoff.

## Milestone 0 — Foundation (20 minutes)

### Build

- Create the XWALK KEYBOARDS app from
  `web-scaffold-static-nextjs`, retaining its Cloud Run-ready Docker/build
  conventions.
- Establish routes for `/`, `/realtime`, `/orchestration`, and
  `/camera-registry`; placeholder route content is sufficient initially.
- Copy the canonical priority/fallback camera set above and existing
  calibration JSON files into a source-controlled app registry, with no
  secrets in client code.
- Configure local environment variables and Cloud Run Secret Manager bindings
  described in [deployment.md](deployment.md).
- Add a lightweight health indicator or route suitable for deployment checks.

### Verify

- `pnpm build` succeeds.
- A first Cloud Run revision is reachable in project `xwalk-keyboards-01`.
- The deployed route returns successfully on desktop Chrome.

### Cut line

Use static placeholder data and a text-only home route. Do not wait for final
branding, Figma-perfect layout, or any Roboflow request to establish this
deployment path.

## Milestone 1 — Camera Registry (35 minutes)

The registry is intentionally the first product milestone. It exercises
camera configuration, snapshot loading, unavailable-state handling, shared
navigation, responsive image presentation, and Cloud Run deployment without
making Roboflow inference a prerequisite.

### Build

- Render all priority cameras in their configured order, labeled
  `Camera <index> · View <id>`.
- Render fallback cameras in their configured fallback order.
- Fetch one static image per camera on initial load only; do not poll and do
  not call Roboflow from this route.
- Display a deliberate unavailable card when a source returns a known service
  or no-live-feed image.
- Include a direct link to `https://511ny.org/map/Cctv/<view-id>` for every
  card and the configured vertical list of live feeds.
- Deploy the registry to Cloud Run.

### Verify

- The deployed registry shows all configured priority and fallback entries.
- At least one unavailable source is represented cleanly rather than breaking
  layout.
- Direct links open the expected 511NY camera pages.
- No Roboflow API calls occur while using this page.

### Cut line

The registry may use a straightforward responsive grid. Snapshot timestamps,
additional camera metadata, and Figma-level motion are optional.

## Milestone 2 — Realtime study (90 minutes, top priority)

### Realtime-camera recalibration gate

View `5059` is retired from this build because its moved view no longer shows
the required intersection. Before implementing the study, complete the
following for View `5056`:

1. Capture a representative native video frame and record its actual input
   dimensions; do not use dimensions from a browser screenshot.
2. Draw fresh left and right crosswalk polygons against that frame in the
   Roboflow tool, then store the returned pixel coordinates under
   `camera_5056` with the reference-frame dimensions.
3. Draw and order the client-side stripe regions for both crosswalks. Preserve
   the unplayable median and calculate the continuous right-to-left keyboard
   mapping from the new frame.
4. Update `pedestrian-detection-RT` (or the selected Realtime workflow) to
   accept the new `crosswalk_left_polygon` and `crosswalk_right_polygon`
   parameters; publish and test it against View `5056`.
5. Update the browser registry, HLS source, polygon lookup, stripe lookup, and
   automated calibration checks together. No runtime path may retain
   `camera_5059`.

### Build in this order

1. **Live display:** Mount the curated View `5056` HLS source in a local
   `<video>` element using the prototype playback strategy. Surface camera
   connection/loading/error independently from inference state.
2. **Inference:** Reuse the Roboflow WebRTC data path and private-key server
   boundary. Send the active frame plus `classes`,
   `crosswalk_left_polygon`, and `crosswalk_right_polygon` from the calibrated
   View `5056` configuration.
3. **Rendering:** Keep video rendering independent from inference. Draw only
   the calibrated, occupied-stripe glow in a canvas overlay; do not render
   pedestrian triangles in Realtime.
4. **Audio:** Use browser Web Audio and the existing two-crosswalk stripe
   mapping. Trigger notes only for inside-left or inside-right detections;
   ignore outside detections and allow previously triggered sounds to decay.
5. **Controls and resilience:** Add the accurate `SOUND ON`/`SOUND OFF` state,
   fullscreen/escape behavior, manual reconnect, and route cleanup.
6. **Deploy and review:** Test the deployed experience before proceeding.
7. **Capture the fallback demo:** As soon as the deployed Realtime study is
   confirmed, record a short video showing video arrival, active inference,
   an occupied-stripe glow, and audible piano notes. Keep the video available
   for judging in case the live camera or inference service is unavailable at
   demo time.

### Verify

- Camera video can become available before inference, and inference can become
  available before the camera; both states remain understandable.
- A person inside either calibrated crosswalk creates an occupied stripe glow
  and its corresponding note.
- A person outside both crosswalks creates neither a glow nor a note.
- Audio is enabled only after the required user gesture and is silenced on
  toggle-off or route exit.
- Fullscreen exits on click or Escape, and the deployed route recovers from a
  temporary HLS or inference failure.

### Cut line

If the Roboflow visual overlay needs more time, retain live HLS video and
sound-state controls, then add inference/audio only once the direct prototype
path is working. Do not substitute a new inference architecture. Fancy
transitions, multiple live cameras, and nonessential labels are out of scope.

## Milestone 3 — Orchestration study (60 minutes, secondary priority)

Build the reliable performance baseline first. The conductor and hero
presentation are extensions, not prerequisites for an Orchestration demo.

### Baseline build

- Load the twelve configured priority snapshots in 3 × 4 order and begin
  background polling after their initial display.
- Detect changed source images, reject known maintenance/unavailable images,
  and substitute a configured fallback when necessary.
- Maintain one queued annotated image per camera. Invoke the pedestrian
  workflow only for changed queued images, passing each camera's polygon.
- Do not begin the performance until all twelve queues have one usable image;
  show a general preparation indicator meanwhile.
- Freeze a complete 12-image batch, then advance the active camera in reading
  order every five seconds. The active frame is full color; the remaining
  frames are grayscale.
- Pre-render one Canvas grayscale 3 × 4 base for each frozen batch, then
  composite the matching active full-color annotated image over its grid cell
  at each five-second interval. Do not re-transform all twelve images per
  presentation update.
- Use the annotated output in this study: green triangles for inside-crosswalk
  detections and purple triangles for outside detections. Do not show Realtime
  stripe glows here.
- Schedule conservative Tone.js notes from occupied stripe indexes. The score
  may initially use deterministic defaults rather than the conductor agent.
- Run a fixed 96 BPM, 4/4 Tone.js transport with a restrained continuous
  background beat. Each five-second camera interval must occupy two bars;
  client-defined two-bar patterns quantize notes selected by the score's
  existing `gesture` field.

### Conductor and hero extension, only after the baseline works

- Deploy `xwalk-conductor-agent` to its own Cloud Run service.
- Compose the frozen 3 × 4 canvas image and post it with its manifest to the
  Next.js server route; never expose the agent key in the browser.
- Validate the schema-version-3 response described in
  [conductor-score-schema.md](conductor-score-schema.md).
- Honor `visual.presentation: "grid"` immediately. Add `"hero"` only after
  the validated score, frozen active image, and five-second timing remain
  synchronized.

### Verify

- The performance does not start until a full usable batch is ready.
- A camera’s next image is never displayed with another camera’s inference
  result or a mismatched score.
- The active camera advances every five seconds, loops after Camera 12, and
  notes are allowed to decay into the following interval.
- At `SOUND ON`, the background beat continues through an empty crosswalk
  interval, and any pedestrian notes remain quantized to the 96 BPM beat grid.
- On a late/invalid next batch or score, the prior valid batch keeps playing.
- If enabled, a `hero` event uses the exact active frozen camera image and
  begins with its matching audio interval.

### Cut line

The demo-safe Orchestration outcome is a single deterministic, complete
12-camera batch with the five-second cycle. Defer the agent service, hero
events, repeated live polling, rich effects, and fullscreen if they threaten
that baseline or the documentation deadline.

## Milestone 4 — Homepage and navigation (15 minutes)

### Build

- Implement the homepage hero and scroll-to-selector interaction from Figma.
- Make Realtime the highlighted default study, with Orchestration visibly
  available as the alternate selection.
- Link the wordmark to the homepage and the footer to the Camera Registry from
  every route.

### Cut line

Use a static/darkened background or an existing image instead of a live video
background if needed. Correct route navigation matters more than motion.

## Milestone 5 — Documentation and handoff (20 minutes)

### Build

- Add an app README with the demo URL, local setup, required environment
  variables by name only, deployment command, architecture summary, and a
  short privacy/data-use note.
- Add an agent README with its endpoint contract, local setup, Secret Manager
  requirements, and Cloud Run deploy command.
- Update [deployment.md](deployment.md) with actual deployed service names,
  regions, URLs, secrets, and smoke-test date.
- Create a FigJam system diagram covering 511NY sources, the browser/Next.js
  app, Roboflow, Cloud Run, the optional conductor service, and the two audio
  paths.
- Capture the final demo URL and known limitations for judges.

### Verify

- A teammate can open the README and run the documented deployed smoke test.
- Neither README contains an API key or other secret.
- The FigJam diagram agrees with the deployed system, not merely the target
  architecture.

## Decision gates and escalation rules

| At | Ask | Decision |
| --- | --- | --- |
| 0:55 | Is the Camera Registry deployed and loading real sources? | If no, keep working on deployment/source loading; do not begin Roboflow. |
| 2:25 | Is deployed Realtime video + inside-crosswalk audio reviewed? | If no, spend the remaining build time fixing Realtime. Orchestration becomes a static visual preview only. |
| 3:25 | Does Orchestration have a complete stable twelve-camera loop? | If no, freeze the last valid batch and present it deterministically; skip the conductor/hero extension. |
| 3:40 | Are both primary demo routes reachable? | If yes, stop feature work and finish documentation/diagram. |

## Demo script

1. Open the deployed homepage and choose **Realtime**.
2. Show West Street at W. 34 St video arriving independently from inference, enable sound,
   and point out an occupied stripe creating a note.
3. Open the Camera Registry to show the curated priority/fallback data and
   direct NYC 511 links.
4. Open **Orchestration** and show the frozen 3 × 4 performance, five-second
   camera progression, color/grayscale emphasis, annotated detections, and
   Tone.js audio. If complete, show an agent-selected hero event.
5. Close with the README and FigJam diagram, naming the live NYC source,
   Roboflow vision layer, Google Cloud deployment, and graceful fallback
   behavior.

## Explicitly deferred unless ahead of schedule

- Additional live camera studies beyond View `5056`.
- A bespoke model, retraining, or changes to the tested Roboflow workflow.
- Cloud Storage/Eventarc orchestration automation; in-browser queues are the
  event-time path.
- MRT2 integration.
- Advanced effects, generated composition variation, and extra homepage
  motion beyond the reviewed Figma flows.
