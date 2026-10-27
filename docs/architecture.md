# XWALK KEYBOARDS Technical Architecture

## Purpose and scope

This document describes the production architecture of **XWALK KEYBOARDS**
after the live study was retired.

XWALK KEYBOARDS turned live traffic-camera crosswalks into piano keyboards.
The Realtime study ran Roboflow person detection over WebRTC, read stripe
geometry from a separate calibration agent, and played notes with the Web
Audio API. That pipeline has been removed. Its design lives in this file's git
history, before the retirement commit, and in
[`calibration-drift-agent.md`](calibration-drift-agent.md).

What remains:

| Page | Purpose | Media |
| --- | --- | --- |
| Homepage (`/`) | Hero, then an introduction video of screen recordings from the study | Live 5059 HLS background; YouTube embed |
| About (`/about`) | Project description | Live 5059 HLS background |
| Camera Registry (`/camera-registry`) | Unlinked developer view of every registered camera | One muted live HLS preview per camera |

`/realtime` and `/realtime/:cameraId` redirect permanently to `/`, so links
shared while the study ran still land somewhere.

Two properties still hold:

1. **No private origins in the browser.** Upstream HLS locations stay in
   server-only modules or environment variables.
2. **Media work stops when its route is left.** Navigation disposes of the HLS
   players that belong to the previous route.

## System overview

```text
+------------------------------+
| Browser                      |
| Homepage, About,             |
| and Camera Registry          |
+------+---------------+-------+
       |               |
       | same-origin   | youtube-nocookie.com iframe
       | GET /api/hls/*| (homepage only)
       v               v
+------+----------------------+   +-----------+
| Next.js web app / Cloud Run |   | YouTube   |
| HLS proxy, input validation |   +-----------+
+------+----------------------+
       |
       | server-side GETs (Direct VPC egress for CARLA)
       v
+---------------------------------+
| Registered HLS sources          |
| 511NY, City of Bellevue, CARLA  |
+---------------------------------+
```

## Camera registry

Camera metadata is version-controlled in `src/data/cameras.ts`. No provider
inventory API is called at runtime.

```ts
type LiveCameraRecord = {
  cameraId: number;                 // stable numeric ID; Bellevue = 8 + CCTV number, CARLA = 90014
  displayLabel: string;
  location: string;                 // human-readable intersection
  sourceId: string;                 // the provider's own identifier
  externalUrl?: string;             // provider's public page; absent when private
  sourceKind: "511ny" | "bellevue" | "carla";
  statusLabel: string;              // short status-bar name, e.g. "WEST STREET @ W23 ST"
};
```

Client-importable records never contain upstream HLS URLs. The server maps
each camera ID to its upstream HLS directory in `src/server/hls-sources.ts`
and resolves CARLA camera `90014` from `CARLA_HLS_BASE_URL`. Browsers always
request the same allowlisted `/api/hls/:cameraId/:path*` route.
`DEFAULT_LIVE_CAMERA` (5059) backs the homepage and About backgrounds.

The Camera Registry derives its cards from the registry, so adding or removing
a camera needs no other edit.

## HLS proxy

`GET /api/hls/:cameraId/:path*` validates the camera ID and path segments
against the registry, then fetches the upstream with
`Accept-Encoding: identity` and forwards byte ranges for media segments. This
avoids an observed upstream gzip / `206 Partial Content` decoding failure in
Chrome. Responses are `no-store`, and every fetch carries an explicit timeout.

Playback uses `hls.js` when Media Source Extensions are available and falls
back to native HLS where supported. On fatal network or media errors it
retries with a fixed backoff. The ambient backgrounds report `connecting`,
`live`, `reconnecting`, or `unavailable` to the status line
("FEED LIVE // WEST STREET @ W23 ST").

## Introduction video

`src/components/intro-video.tsx` embeds the video with an iframe from
`youtube-nocookie.com`, so YouTube sets no cookies until the visitor plays it.
The iframe is lazy-loaded with `loading="lazy"`, which keeps it out of the
hero's first paint. The video ID is the exported constant `INTRO_VIDEO_ID`.
The Figma frames (506:449 desktop, 508:75 mobile) draw a mock player. The
runtime uses YouTube's own player and controls instead.

## Configuration

One server-only environment value is required:

```text
CARLA_HLS_BASE_URL (private HLS directory for camera 90014)
```

Cloud Run keeps Direct VPC egress (`private-ranges-only`) so the server can
reach the CARLA origin. The deploy workflow verifies that configuration on
every revision.

## Route cleanup contract

| Leaving route | Required cleanup |
| --- | --- |
| Homepage, About | Destroy the background `hls.js`, clear retry timers, pause and unload the video |
| Camera Registry | Destroy each preview's `hls.js`, clear retry timers, and pause and unload preview videos |

## Verification

- Unit tests (`pnpm test`): registry completeness, unique IDs, stable order,
  no upstream URLs in client metadata, HLS source resolution, and HLS proxy
  validation and encoding.
- End-to-end tests (`pnpm test:e2e`): homepage hero and introduction band
  (desktop and mobile), `/realtime` redirects, About, Camera Registry.
- See [`users-scenarios.md`](users-scenarios.md) for the behaviour each test
  covers.
