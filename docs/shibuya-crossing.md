# Shibuya Crossing

Researched September 27, 2026. Research into adding Tokyo's Shibuya Scramble Crossing as a Realtime camera. No app code was changed.

> **Status: canceled (VIN-83, 2026-09-27).** There is no usable live feed. Every live Shibuya Crossing feed runs through YouTube, which can't be proxied (see below). The SHIBUYA SKY camera isn't broadcasting, and a reply from FNN is unlikely. Revisit only if a direct, non-YouTube stream becomes available. The rest of this doc records the plan as it stood before cancellation.

## Decision (superseded)

**Build it on the FNN feed, reached through a licensed direct stream, as a normal HLS camera.** Until that stream exists, make the music changes Shibuya needs; they work on any camera. Validate the sound with a prototype that runs only in local development and never deploys.

## The three feeds

| Feed | Live | Embeddable | Fit |
| --- | --- | --- | --- |
| [FNN](https://www.youtube.com/watch?v=dfVK7ld38Ys) (`@FNNnewsCH`) | yes | yes | **Best.** A high, angled, fixed view. All five crosswalks show clear zebra stripes, including the long diagonal. |
| [ANN / TV Asahi](https://www.youtube.com/watch?v=8H3nRCFVR6Y) (`@ANNnewsCH`) | yes | yes | Poor. The camera is at street level and the crowd hides the stripes, so they can't be mapped to keys. |
| [SHIBUYA SKY](https://www.youtube.com/watch?v=3Q5wZeTuttw) | no, at check time | no | Poor. The stripes are clean from 229 m, but people are a few pixels tall, below what the person detector can find. |

Live and embed status came from each watch page's `isLiveNow` and `playableInEmbed` fields. Stripe geometry was first judged from each stream's live thumbnail (`maxresdefault_live.jpg`).

**FNN confirmed (2026-09-27, Tokyo night).** Vince watched the stream and confirmed live motion; there were very few pedestrians at that hour, which is why the thumbnail looked like a still. Roboflow crosswalk segmentation on a frame of the embedded player found all five crosswalks: top-left, the small far crossing on the upper-left approach, right, the long middle crossing, and the bottom one. Counted from the mask, that's roughly 90 stripes, consistent with the estimate below.

In that same frame, YouTube's title bar covered the top of the video and its control bar covered the bottom. The FNN logo sits at the bottom right. Any frame capture must hide or crop these (see step 3).

### SHIBUYA SKY cameras (checked 2026-09-27)

- **Operator:** Shibuya Scramble Square Co., a joint venture of Tokyu, JR East and Tokyo Metro. The "SKY LIVE CAMERA" is mounted about 230 m up, on SHIBUYA SKY at the top of Scramble Square.
- **Other camera positions:** listings also name the 14th floor, the 45th and 46th floors, and the rooftop.
- **View:** looks straight down on the crossing. Every zebra crossing, including both diagonals, is crisp and unobstructed. Pedestrians show as dots of a few pixels in the 1280×720 thumbnail.
- **Broadcast history:** it has only streamed in stints on the official channel (`UCWs8rt4ofGmdV4N6KQpP10Q`), and every stream blocked embedding.

| Video | Streamed |
| --- | --- |
| `vUVINoqhWMA` | 2022-08-02 to 2023-03-05 (the launch press release dates the launch 2022-09-13) |
| `USisUITA980` | 2024-02-17 to 2024-02-19 |
| `27C_NaWNVUo` | 2025-07-31 to 2025-09-05 |
| `4ffe7JI3zSs` | 11 seconds on 2025-05-20 |

Nothing is live now; the channel's streams tab otherwise holds only rooftop DJ sets. The one contact found is the SHIBUYA SKY inquiry desk (03-4221-0229) in the [launch press release](https://prtimes.jp/main/html/rd/p/000000047.000046405.html).

The Shibuya Center-gai shopping street association runs two live, embeddable cameras (`d1JuNg7knNo` at the main arch, `EaRgJQ--2eE` outside McDonald's). Both point down Center-gai, not at the crossing's stripes.

## Why YouTube can't be a source directly

The Realtime pipeline needs pixels it is allowed to read. The browser draws a same-origin `<video>` element (`captureStream` / canvas) into Roboflow WebRTC, and the calibration agent decodes frames on the server from the HLS proxy. YouTube allows neither:

- The embedded player is a cross-origin iframe, so the page can't read its pixels.
- Pulling YouTube's `hlsManifestUrl` on the server (for example with yt-dlp) and proxying it breaks the [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies). They forbid storing copies without written approval and forbid separating or modifying the video. The approach would also be fragile: the URLs are signed and expire, and YouTube challenges traffic from data centres such as Cloud Run.

## Plan

### 1. Get a licensed direct stream (blocks production)

- Ask FNN (Fuji Television) for a direct HLS or RTMP feed of this camera, or written approval, for a non-commercial art project.
- If FNN declines or doesn't reply within 3 weeks, ask Shibuya Scramble Square (SHIBUYA SKY also runs a 14th-floor camera) and [SkylineWebcams](https://www.skylinewebcams.com/en/webcam/japan/kanto/tokyo/tokyo-shibuya-scramble-crossing.html), which licenses its feeds.
- If nobody grants a feed, keep the music changes from step 2 and drop Shibuya.

Once granted, register it the way CARLA 90014 is registered:

- camera `81001` (a made-up ID following the 8xxxx convention) with a new `sourceKind`;
- a server-only upstream from an environment variable, for example `SHIBUYA_HLS_BASE_URL`, in `src/server/hls-sources.ts`;
- an empty baked-in `calibration`.

The proxy, calibration agent and homepage availability check then work unchanged.

### 2. Music changes for dense crossings (buildable now)

These change the musical rules only, which the app owns; the agent keeps its geometry side as is.

- **A per-camera scale.** FNN shows about 80–100 stripes, and `noteForOrdinal` (`baseAnchor + globalOrdinal`, chromatic) would run past the top of a piano (C8 is C4 + 48). Add a `scale` field to `LiveCameraRecord` that maps the global ordinal onto a scale that wraps back down, such as pentatonic across a fixed octave span. It defaults to `"chromatic"`, so every existing camera sounds identical.
- **Trigger on arrival.** A stripe sounds when it goes from empty to occupied, not for as long as it stays occupied. Without this, the all-walk phase is one continuous cluster of every note.
- **Density sets volume, with a cap.** The number of people on a stripe sets its volume, and a per-camera limit caps how many notes sound at once.
- The scramble's roughly two-minute signal cycle becomes the piece's structure: quiet while cars move, then a burst when everyone crosses.

### 3. Local-only prototype to validate the sound

- A development-only page (gated on `NODE_ENV === "development"`, so it never ships) embeds the FNN player through the YouTube IFrame API, muted.
- It captures the current tab with `getDisplayMedia({ preferCurrentTab: true })` and crops the capture to the player element with Region Capture (`CropTarget.fromElement`). The resulting video feeds the existing Roboflow WebRTC setup in `realtime-inference.tsx`.
- Load the player with `controls=0` so its control bar doesn't land in the captured frames. Check whether the title bar still appears; if it does, crop it out.
- Draw the stripe glow on our own canvas, not on top of the YouTube player. YouTube's Required Minimum Functionality rules appear to forbid overlays in front of an embedded player; confirm the exact wording. One layout: the captured stream mirrored into our canvas, with the glow drawn there and the official player visible alongside it.
- Seed `public/calibration-fallback-81001.json` from Roboflow's crosswalk segmentation on a quiet frame (night works well), then split each crosswalk mask into stripes and review them by hand. The agent can't fetch YouTube frames itself.
- It runs in desktop Chrome only, shows a permission prompt each session, and is a grey area under the policies above. It exists only to decide whether Shibuya sounds worth licensing.

## Risks to measure in the prototype

- **Detecting small, overlapping people.** People are small in a 1280×720 frame. Expect to need a Workflow that slices each frame into tiles and stitches the detections back together. That multiplies inference cost per frame; measure it before choosing a frame rate.
- **Stripes hidden by the crowd.** Calibrate during the vehicle phase. At runtime, rely on boundary memory (`detect_boundaries`), since the stripes are hidden during the all-walk phase.
- **Timing.** Tokyo is UTC+9, so a US Pacific evening is Tokyo's morning rush.
