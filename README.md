# XWALK KEYBOARDS

**[xwalkkeyboards.app](https://xwalkkeyboards.app)**

XWALK KEYBOARDS turned live traffic-camera crosswalks into playable piano
keyboards. Pedestrians stepping on the painted white stripes of a crosswalk
triggered notes — each stripe a key, the whole crossing an ascending chromatic
scale from left to right.

The live study has been retired. The site now plays an introduction video of
screen recordings from the study, over a live ambient traffic-camera feed.

[![XWALK KEYBOARDS — Realtime study, West Street at W. 23 St](https://www.vinceallen.com/images/xwalk-keyboards/screenshot-01.png)](https://xwalkkeyboards.app)

## How it worked

A registered traffic-camera feed streamed to the browser over same-origin HLS,
from [511NY](https://511ny.org) cameras on West Street in New York, the City
of Bellevue, WA's public [traffic cameras](https://trafficmap.bellevuewa.gov),
and a private CARLA Town10 simulation. The browser sent frames to a
[Roboflow](https://roboflow.com) workflow over WebRTC for person detection,
mapped each pedestrian to the crosswalk stripe they stood on, and played the
corresponding note through the Web Audio API, with occupied stripes glowing
mint over the video.

The crosswalk geometry came from a separate
[calibration agent](https://github.com/vinceallenvince/xwalk-camera-calibration-agent)
that used a reasoning vision-language model to locate the painted stripes in
the current camera frame. The agent owned geometry; the app owned the musical
contract.

## What runs today

```
Browser                         Next.js (Cloud Run)              External
─────────────────────────       ─────────────────────────        ─────────────────────
Live background / registry ──▶  HLS proxy (identity enc.)   ──▶  Bellevue / 511NY / CARLA
Introduction video         ──────────────────────────────────▶  YouTube (nocookie embed)
```

- **Homepage**: the introduction video over a darkened live camera feed.
- **About**: the project description over the same feed.
- **Camera Registry** (`/camera-registry`, unlinked): every registered camera's
  live feed, for developers.

Upstream media origins stay server-side; the browser only requests the
same-origin HLS proxy. Old `/realtime` links redirect to the homepage.

## Design

- **[Figma — UI Design](https://www.figma.com/design/VgqJ1zX1eByz9c8Ui8otpY/XWALK-KEYBOARDS?node-id=57-23&t=AlqZx4IZ279b4XeZ-1)** — screens, components, and mobile frames for every user scenario
- **[Figma — System Design & Calibration Strategy](https://www.figma.com/board/A6NvdXlqnQF4ZXUJuwrGbD/XWALK-KEYBOARDS---System-Diagram?node-id=0-1&t=UvAg5BVHz0mrPyqh-1)** — architecture diagrams and the calibration drift agent design

## Related repositories

- **[xwalk-camera-calibration-agent](https://github.com/vinceallenvince/xwalk-camera-calibration-agent)** — Python Cloud Run service that published crosswalk stripe geometry to GCS (retired)

## Development

```bash
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm test         # vitest
```

Requires Node.js and [pnpm](https://pnpm.io). Server-only environment
variables are listed in `.env.example`.
