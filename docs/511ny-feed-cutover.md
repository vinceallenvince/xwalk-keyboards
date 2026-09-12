# 511NY Feed Cutover Plan

## Context

511NY is switching to a new vendor, **Castle Rock Associates**, on
**September 30, 2026**. The legacy data feeds will be retired on that date.
Castle Rock has provided a staging CCTV XML feed for testing. The production
endpoint will be provided separately before cutover.

This document records what we verified against the test feed and the plan for
switching.

## Test feed

- **Portal:** `https://nysdot-carsprogram-org.stage.carstest.org/hub/index.jsf`
- **CCTV feed:** `https://nysdot-carsprogram-org.stage.carstest.org/hub/data/cctv.xml`
- **Schema:** `https://nysdot-carsprogram-org.stage.carstest.org/hub/schemas/CCTV.xsd`
- **Auth:** HTTP Basic (credentials stored locally in `511ny`, gitignored)

The feed is a CARS-Hub XML document (`cctvInventories`) containing ~2,717
cameras across two owners: NYSDOT (~1,748) and NYC DOT (~969).

## What we verified (2026-09-12)

### Live cameras — all present, HLS unchanged

All four registered live cameras appear in the new feed:

| Our ID | Device ID | Feed name | Stream ID | HLS URL unchanged? |
| --- | --- | --- | --- | --- |
| 5056 | 31211 | West Street at W. 34 St | R11_272 | ✅ Yes |
| 5059 | 31215 | West Street at W. 23 St | R11_275 | ✅ Yes |
| 5062 | 31218 | West Street median/at Spring St | R11_278 | ✅ Yes |
| 5072 | 31228 | West Street at Chambers St | R11_279 | ✅ Yes |

The `video-url` values are **identical** to what we use today in
`src/data/cameras.ts`. Same `s9.nysdot.skyvdn.com` CDN, same `R11_*` stream
identifiers. All four HLS playlists returned HTTP 200 on the test date.

**Conclusion: no code change is needed for live HLS video.**

### New still-image source

The feed provides still images at a new domain:

```
https://public.carsprogram.org/cameras/NYSDOT/<streamId>.flv.png
```

All four live camera stills returned HTTP 200 with JPEG content. This is a
publicly accessible URL (no auth required to fetch the image itself).

This is **not** the same as the current `511ny.org/map/Cctv/<viewId>` snapshot
source. It is an additional source that ships with the new feed.

### Static registry cameras — ID mapping required

Our 16 static registry cameras (3107, 3230, 3256, etc.) use 511NY view IDs.
These IDs do not appear in the new feed as `device-id` values. The NYC DOT
cameras are present in the feed but keyed by Castle Rock device IDs and use
`nyctmc.org/api/cameras/<uuid>/image` snapshot URLs.

Matching our registry cameras to the new feed requires matching by
name/location or by cross-referencing against the 511NY map.

### Feed structure

Each camera record (`inventory-item`) contains:

```xml
<inventory-item>
  <device-id>31211</device-id>
  <device-updated>
    <date>20260912</date>
    <time>111159</time>
    <utc-offset>-0400</utc-offset>
  </device-updated>
  <device-name>West Street at W. 34 St</device-name>
  <video-url>https://s9.nysdot.skyvdn.com/rtplive/R11_272/playlist.m3u8</video-url>
  <still-images>
    <still-image>
      <name>West Street at W. 34 St</name>
      <url>https://public.carsprogram.org/cameras/NYSDOT/R11_272.flv.png</url>
    </still-image>
  </still-images>
  <location>
    <geo-location>
      <latitude>40757113</latitude>
      <longitude>-74004702</longitude>
    </geo-location>
    <link-ownership>New York State</link-ownership>
    <route-designator>NY 9A</route-designator>
  </location>
</inventory-item>
```

Key differences from the legacy feed:

- `device-id` is a Castle Rock internal ID, not the 511NY view ID
- Still images use `public.carsprogram.org` instead of `511ny.org`
- The feed itself requires HTTP Basic auth; individual image/stream URLs do not

## Impact assessment

| Component | Risk | Action required |
| --- | --- | --- |
| **Live HLS streams** (`s9.nysdot.skyvdn.com`) | ✅ None — URLs unchanged | None |
| **Live camera still images** | ⚠️ Low — new source available | Optional: switch to `public.carsprogram.org` stills |
| **Snapshot proxy** (`/api/snapshot/[cameraId]`) | ⚠️ Medium — `511ny.org/map/Cctv/` may stop working | Update proxy to use new still-image URLs |
| **Static registry snapshots** | ⚠️ Medium — need ID mapping | Map 511NY view IDs → new feed entries |
| **Calibration agent** (`xwalk-camera-calibration-agent`) | ⚠️ Medium — uses `511ny.org` stills | Update `SNAPSHOT_URL_TEMPLATE` to new domain |
| **HLS CDN** (`s9.nysdot.skyvdn.com`) | ❓ Unknown — may change at cutover | Monitor; the feed will carry the authoritative URLs |

## Switchover plan

### Before Sept 30: prepare (no production changes yet)

1. **Map live cameras to new device IDs.** Add a `deviceId` or
   `castleRockId` field to `LiveCameraRecord` and `CameraRecord` in
   `src/data/cameras.ts` to record the mapping. This is documentation now and
   will be needed if we ever consume the feed at runtime.

   | Our ID | Castle Rock device-id |
   | --- | --- |
   | 5056 | 31211 |
   | 5059 | 31215 |
   | 5062 | 31218 |
   | 5072 | 31228 |

2. **Build the snapshot URL from the stream ID.** The still-image URL pattern
   is deterministic: `https://public.carsprogram.org/cameras/NYSDOT/<streamId>.flv.png`.
   We already have the stream ID embedded in the HLS URL (the `R11_*` segment).
   Add a helper that derives the still URL from the stream ID.

3. **Map static registry cameras.** For the 16 registry cameras, match each
   511NY view ID to the new feed by name or location. If the `511ny.org`
   snapshot endpoint survives the cutover unchanged (it is a web-app route, not
   a data feed), this is deferred.

4. **Update the calibration agent.** In `xwalk-camera-calibration-agent`,
   update `SNAPSHOT_URL_TEMPLATE` to use `public.carsprogram.org` stills.
   The new URL is camera-keyed by stream ID (R11_272, etc.), not by 511NY view
   ID (5056, etc.), so the agent's camera config needs the stream ID added.

### At cutover (Sept 30 or when production endpoint is provided)

5. **Verify the production feed URL** returns the same structure as the test
   feed, with the same HLS and still-image URLs.

6. **Verify HLS streams still resolve.** The `s9.nysdot.skyvdn.com` CDN may
   or may not change. The production feed will carry the authoritative URLs. If
   they change, update `LIVE_CAMERAS[].hlsUrl` in `src/data/cameras.ts`.

7. **Switch the snapshot proxy.** Update `/api/snapshot/[cameraId]` to fetch
   from `public.carsprogram.org` instead of `511ny.org`.

8. **Switch the calibration agent stills** if not already done in step 4.

9. **Verify the Camera Registry** page still loads snapshots for all 16
   static cameras.

### After cutover

10. **Update `docs/511NY-api.md`** with the new endpoint documentation and
    remove references to the legacy feed.

11. **Store production feed credentials** in Secret Manager if we decide to
    consume the XML feed at runtime (for camera discovery or health checks).
    Today we hardcode cameras and do not call the feed at runtime.

## Open questions

- **Will `511ny.org/map/Cctv/<viewId>` survive?** This is the 511NY web app's
  snapshot route, not a data feed endpoint. It may survive the vendor change
  since the web app is a consumer of the feed, not the feed itself. If it
  survives, static registry cameras need no immediate change.

- **Will the HLS CDN (`skyvdn.com`) change?** The test feed carries the same
  CDN URLs we use today. If the production feed carries different URLs, we need
  to update `LIVE_CAMERAS[].hlsUrl`.

- **Do we need the feed at runtime?** Today we hardcode everything and never
  call the feed. If cameras move or get new stream IDs, consuming the feed
  would let us discover that. This is a future consideration, not a cutover
  requirement.
