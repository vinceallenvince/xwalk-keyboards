# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

XWALK KEYBOARDS turns live NYC traffic-camera crosswalks into playable piano keyboards. Pedestrians inside a crosswalk trigger notes mapped to C harmonic minor by stripe position. Deployed to Google Cloud Run (project `xwalk-keyboards-01`).

## Commands

```bash
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # eslint (core-web-vitals)
pnpm test         # vitest run (all tests, no watch)
```

Package manager is **pnpm** (v8.15.3 via `packageManager` field). The Dockerfile uses `npm` for the container build.

## Architecture

### Two studies, two audio engines, zero shared audio code

| | Realtime (`/realtime`) | Orchestration (`/orchestration`) |
|---|---|---|
| Source | One live HLS camera (View 5056) | 12 curated static snapshot cameras |
| Vision | Roboflow WebRTC — current frame | Roboflow HTTP per changed snapshot |
| Audio | Browser Web Audio API (`AudioContext`) | Tone.js — 96 BPM, 4/4, 60s scored loop |
| Visual | Mint stripe glow on canvas overlay | Green/purple triangles on annotated images |
| Scoring | None — event-driven from detections | External Python agent (ADK + Gemini) returns declarative score data |

The studies share only the camera registry (`src/data/cameras.ts`) and site chrome (`src/components/site-chrome.tsx`).

### Server boundary

All third-party API keys (Roboflow, Crosswalk Score Agent) stay server-side in Next.js API routes. The browser never contacts Roboflow or Gemini directly. Every API route uses `force-dynamic`, validates inputs, has explicit `AbortSignal.timeout`, and returns `Cache-Control: no-store`.

### Key API routes

- `GET /api/hls/[cameraId]/[...path]` — HLS proxy (fetches with `Accept-Encoding: identity` to avoid NYSDOT gzip/206 bug)
- `GET /api/snapshot/[cameraId]` — static image proxy with SHA-256 unavailable-image classification
- `POST /api/roboflow/webrtc` — WebRTC offer proxy with server-side polygon scaling
- `POST /api/roboflow/image` — snapshot inference with per-camera calibrated polygons
- `POST /api/score-batch` — validates manifest+composite, forwards to external scoring agent

### Calibration data lives in two places

- **Static cameras**: `docs/calibrations/priority-crosswalk-polygons.json` — imported at build time by `src/lib/orchestration-calibration.ts`
- **Realtime stripes**: hardcoded in `src/lib/realtime-calibration.ts` — 25 stripes across left/right crosswalk segments, mapped C4–C6

Both use a reference frame with explicit dimensions. Polygons scale to actual input frame size via `x * targetWidth / referenceWidth`.

### Orchestration data flow

1. Browser polls 12 snapshot slots → detects changed bytes by SHA-256
2. Changed images go to Roboflow inference queue (bounded concurrency)
3. When all 12 slots have annotated frames → freeze immutable batch manifest
4. Browser stitches 12 images into 4×3 canvas composite (1584×891, JPEG)
5. Composite + manifest → `/api/score-batch` → external Python agent → schema v3 score
6. Score validated, Tone.js graph prepared, promoted at next loop boundary
7. Double-buffered: current batch plays while next prepares

### State management

No external state library. Local `useState`/`useRef` only. Refs are used extensively to avoid stale closures in timer callbacks and async chains (`audioEnabledRef`, `activeIndexRef`, `scoreRef`, `queuedFramesRef`, `preparedPerformanceRef`). Generation IDs and `AbortController` prevent stale async results from mutating state after unmount.

### Styling

Single `src/app/globals.css` with CSS custom properties and plain class selectors. No CSS framework, no modules, no Tailwind.

## Score schema

The Crosswalk Score Agent returns schema v3 JSON — declarative data, never executable code. The app owns Tone.js construction and scheduling. Key constraints:

- Exactly 12 events in manifest order, identity fields must match
- Pitches derived from stripe indexes: `0→C4, 1→D4, 2→Eb4, 3→F4, 4→G4, 5→Ab4, 6→B4, 7→C5…`
- Allowlisted instruments (`fmPoly`, `amPoly`, `synthPoly`, `pluck`) and effects
- Visual direction limited to `"grid"` or `"hero"` — no layout/animation/CSS instructions

Full contract in `docs/conductor-score-schema.md`.

## Testing

Tests are co-located with source files (`.test.ts` siblings). Run with `pnpm test`. Coverage areas: camera registry stability, maintenance image SHA-256 classification, polygon scaling, score validation, batch management, Roboflow config parsing, composite layout, detection mapping.

## Environment variables

All server-only (never `NEXT_PUBLIC_`). See `.env.example` for Roboflow bindings. Additionally required for scoring:

```
CROSSWALK_AGENT_URL    # Cloud Run URL of the Python scoring agent
CROSSWALK_AGENT_API_KEY  # shared application key
```

## Deployment

Cloud Run in `us-central1`. Web app URL: `https://xwalk-keyboards-21826886868.us-central1.run.app`. Full runbook in `docs/deployment.md`.
