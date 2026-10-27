# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

XWALK KEYBOARDS turned live traffic-camera crosswalks into playable piano keyboards: pedestrians inside a crosswalk triggered notes mapped chromatically by stripe position. The live study (Realtime: Roboflow person detection, calibration-agent geometry, Web Audio notes) has been retired. The site is now an archive: the homepage plays an introduction video (YouTube) of screen recordings of the study over a live ambient camera feed, plus the About page and the unlinked Camera Registry. Deployed to Google Cloud Run (project `xwalk-keyboards-01`).

## Commands

```bash
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # eslint (core-web-vitals)
pnpm test         # vitest run (all tests, no watch)
```

Package manager is **pnpm** (v8.15.3 via `packageManager` field). The Dockerfile uses `npm` for the container build.

## Architecture

### Pages

- **Homepage (`/`)**: hero over a darkened live HLS background (`DEFAULT_LIVE_CAMERA`, 511NY 5059), then an editorial band with the introduction video (`src/components/intro-video.tsx`, a lazy `youtube-nocookie.com` iframe; video ID in `INTRO_VIDEO_ID`). Figma: 506:449 desktop, 508:75 mobile.
- **About (`/about`)**: same live background behind the project description.
- **Camera Registry (`/camera-registry`)**: unlinked developer page, one card per `LIVE_CAMERAS` entry playing its muted live feed, down feeds kept in place.
- `/realtime` and `/realtime/:cameraId` redirect permanently to `/` (`next.config.mjs`).

### Cameras

Live HLS cameras are registered in `LIVE_CAMERAS` (`src/data/cameras.ts`), with upstream URLs server-only in `src/server/hls-sources.ts`: City of Bellevue 80003/80007/80009/80027 (made-up numeric IDs, 8 + the CCTV number — VIN-85) and 511NY 5056/5059/5062/5072 (West Street, NYC). A private CARLA simulation camera (90014) was retired with its GPU VM.

### Server boundary

Upstream media origins stay server-side. Every API route uses `force-dynamic`, validates inputs, has explicit `AbortSignal.timeout`, and returns `Cache-Control: no-store`.

### API routes

- `GET /api/hls/[cameraId]/[...path]` — HLS proxy (fetches with `Accept-Encoding: identity` to avoid NYSDOT gzip/206 bug)
- `GET /api/health` — health check

### State management

No external state library. Local `useState`/`useRef` only. Refs are used extensively to avoid stale closures in timer callbacks and async chains. Generation IDs and `AbortController` prevent stale async results from mutating state after unmount.

### Styling

Single `src/app/globals.css` with CSS custom properties and plain class selectors. No CSS framework, no modules, no Tailwind.

## Testing

Tests are co-located with source files (`.test.ts` siblings). Run with `pnpm test`. Coverage areas: camera registry stability, HLS source resolution, the HLS proxy route. Playwright e2e specs live in `e2e/` (`pnpm test:e2e`).

## Environment variables

None are required. If one is added, keep it server-only (never `NEXT_PUBLIC_`).

## Deployment

Cloud Run in `us-central1`. Web app URL: `https://xwalk-keyboards-21826886868.us-central1.run.app`. Full runbook in `docs/deployment.md`.
