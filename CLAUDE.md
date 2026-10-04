# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

XWALK KEYBOARDS turns live traffic-camera crosswalks into playable piano keyboards. Pedestrians inside a crosswalk trigger notes mapped chromatically by stripe position. Deployed to Google Cloud Run (project `xwalk-keyboards-01`).

## Commands

```bash
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # eslint (core-web-vitals)
pnpm test         # vitest run (all tests, no watch)
```

Package manager is **pnpm** (v8.15.3 via `packageManager` field). The Dockerfile uses `npm` for the container build.

## Architecture

### One study: Realtime (`/realtime`)

- **Source**: live HLS cameras registered in `LIVE_CAMERAS` (`src/data/cameras.ts`), with upstream URLs server-only in `src/server/hls-sources.ts`: City of Bellevue 80003/80007/80009/80027 (CCTV003/007/009/027 in downtown Bellevue; made-up numeric IDs, 8 + the CCTV number, because the calibration agent's BigQuery `camera_id` is an integer — VIN-85), 511NY 5056/5059/5062/5072 (West Street, NYC), and private CARLA 90014. 511NY kept live video through its 2026-09-30 vendor cutover (VIN-87); the homepage hides any camera whose playlist probe fails (`hls-availability.ts`). 80003/80009/80027 ship with `listed: false` (VIN-86): reachable by URL but left out of navigation until Vince flips them by hand. `DEFAULT_LIVE_CAMERA` is 5059: it backs `/realtime` (no param) and the homepage and About backgrounds (VIN-87; briefly 80007 under VIN-79).
- **Vision**: Roboflow WebRTC — the browser streams decoded frames, the workflow returns person detections for the current frame
- **Audio**: browser Web Audio API (`AudioContext`), one oscillator voice per occupied stripe — event-driven, no scoring
- **Visual**: mint stripe glow on a canvas overlay, keyed by stripe identity (`segment:stripeIndex`)

A previous second study (Orchestration, static snapshot cameras scored by an external agent) was removed. `/camera-registry` is an unlinked developer page: one card per `LIVE_CAMERAS` entry, playing its muted live feed, with down feeds kept in place (VIN-89 dropped the static snapshot cameras and `/api/snapshot`).

### Server boundary

All third-party API keys (Roboflow) stay server-side in Next.js API routes. The browser never contacts Roboflow or Gemini directly. Every API route uses `force-dynamic`, validates inputs, has explicit `AbortSignal.timeout`, and returns `Cache-Control: no-store`.

### Key API routes

- `GET /api/hls/[cameraId]/[...path]` — HLS proxy (fetches with `Accept-Encoding: identity` to avoid NYSDOT gzip/206 bug)
- `POST /api/roboflow/webrtc` — WebRTC offer proxy (class filter only; inside/outside classification happens client-side)
- `GET /api/calibration/[cameraId]` — serves the calibration agent's current published geometry from GCS

### Calibration

Realtime stripe geometry is hardcoded in `src/lib/realtime-calibration.ts` — 25 stripes across two crosswalk clusters, mapped C4–C6. It uses a reference frame with explicit dimensions; polygons scale to the actual input frame via `x * targetWidth / referenceWidth`.

The hardcoded stripes are the **fallback and the scale**, not the live geometry. `src/lib/use-calibration.ts` fetches live polygons from the calibration agent via `/api/calibration/[cameraId]`, falling back to `public/calibration-fallback-[cameraId].json` and then to the hardcoded reference.

**The app owns the musical contract; the agent owns geometry.** The agent is camera-agnostic — it publishes gap-separated stripe clusters (`segment0`, `segment1`, … in positional order) with an ordinal `stripeIndex` inside each, and no note names. The client numbers stripes globally across clusters and plays `baseAnchor + globalOrdinal` (`noteForOrdinal` in `src/lib/realtime-scale.ts`; `baseAnchor` is `C4` for every live camera). Stripe identity is deliberately **not** stable across runs — a missed stripe transposes everything after it until the next calibration (VIN-44).

### State management

No external state library. Local `useState`/`useRef` only. Refs are used extensively to avoid stale closures in timer callbacks and async chains. Generation IDs and `AbortController` prevent stale async results from mutating state after unmount.

### Styling

Single `src/app/globals.css` with CSS custom properties and plain class selectors. No CSS framework, no modules, no Tailwind.

## Testing

Tests are co-located with source files (`.test.ts` siblings). Run with `pnpm test`. Coverage areas: camera registry stability, polygon scaling, scale generation, calibration parsing, Roboflow config parsing, detection mapping.

## Environment variables

All server-only (never `NEXT_PUBLIC_`). See `.env.example` for the Roboflow bindings.

## Deployment

Cloud Run in `us-central1`. Web app URL: `https://xwalk-keyboards-21826886868.us-central1.run.app`. Full runbook in `docs/deployment.md`.
