# XWALK KEYBOARDS

**[xwalkkeyboards.app](https://xwalkkeyboards.app)**

XWALK KEYBOARDS turns live NYC traffic-camera crosswalks into playable piano
keyboards. Pedestrians stepping on the painted white stripes of a crosswalk
trigger notes — each stripe is a key, and the whole crossing plays an ascending
chromatic scale from left to right.

[![XWALK KEYBOARDS — Realtime study, West Street at W. 23 St](https://www.vinceallen.com/images/xwalk-keyboards/screenshot-01.png)](https://xwalkkeyboards.app)

## How it works

A live [511NY](https://511ny.org) traffic-camera feed streams to the browser
over HLS. The browser captures frames and sends them to a
[Roboflow](https://roboflow.com) workflow over WebRTC for person detection. The
app maps each detected pedestrian's position to the crosswalk stripe they are
standing on and plays the corresponding note through the Web Audio API. Occupied
stripes glow mint in a canvas overlay on top of the live video.

The crosswalk geometry — where each stripe is, how wide it is, and how the
stripes group into clusters — comes from a separate
[calibration agent](https://github.com/vinceallenvince/xwalk-camera-calibration-agent)
that uses a reasoning vision-language model to locate the painted stripes in
the current camera frame. The agent publishes stripe polygons; the web app maps
them to notes. The agent owns geometry; the app owns the musical contract.

## Architecture

```
Browser                         Next.js (Cloud Run)              External
─────────────────────────       ─────────────────────────        ─────────────────────
HLS video playback         ──▶  HLS proxy (identity enc.)   ──▶  511NY camera CDN
WebRTC frame capture       ──▶  Roboflow WebRTC proxy       ──▶  Roboflow GPU workers
Stripe overlay (canvas)         Calibration proxy (GCS)     ──▶  Calibration agent
Web Audio (oscillators)         Snapshot proxy                    (VLM → GCS)
```

All third-party API keys stay server-side in Next.js API routes. The browser
never contacts Roboflow or the calibration agent directly.

## Design

- **[Figma — UI Design](https://www.figma.com/design/VgqJ1zX1eByz9c8Ui8otpY/XWALK-KEYBOARDS?node-id=57-23&t=AlqZx4IZ279b4XeZ-1)** — screens, components, and mobile frames for every user scenario
- **[Figma — System Design & Calibration Strategy](https://www.figma.com/board/A6NvdXlqnQF4ZXUJuwrGbD/XWALK-KEYBOARDS---System-Diagram?node-id=0-1&t=UvAg5BVHz0mrPyqh-1)** — architecture diagrams and the calibration drift agent design

## Related repositories

- **[xwalk-camera-calibration-agent](https://github.com/vinceallenvince/xwalk-camera-calibration-agent)** — Python Cloud Run service that publishes crosswalk stripe geometry to GCS

## Development

```bash
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm test         # vitest
```

Requires Node.js and [pnpm](https://pnpm.io). Server-only environment
variables are listed in `.env.example`.
