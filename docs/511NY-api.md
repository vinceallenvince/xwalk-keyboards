# 511NY & NYC DOT Camera Platforms

Reference for the two NYC traffic-camera sources relevant to XWALK KEYBOARDS:
511NY (state, official developer platform) and the NYC DOT Traffic Management
Center webcams API (city, undocumented). Last verified 2026-08-19.

## Endpoints we currently call

### xwalk-keyboards (this repo)

| Purpose | Upstream endpoint | Proxied via |
| --- | --- | --- |
| HLS live streams (Views 5056, 5059, 5062, 5072) | `https://s9.nysdot.skyvdn.com/rtplive/R11_27x/playlist.m3u8` | `GET /api/hls/[cameraId]/[...path]` |

The HLS upstreams are defined server-side in `src/server/hls-sources.ts` and
fetched with `Accept-Encoding: identity` to avoid an NYSDOT gzip/206 bug. The
app no longer proxies 511NY still images: VIN-89 removed `/api/snapshot` and
the 16 static registry cameras. The Camera Registry only links out to each
live camera's public page, `https://511ny.org/map/Cctv/{cameraId}`.

### xwalk-camera-calibration-agent

| Purpose | Upstream endpoint |
| --- | --- |
| Calibration frames | `https://511ny.org/map/Cctv/{camera_id}` (currently only 5056) |

Set in `app/cameras.py` as `SNAPSHOT_URL_TEMPLATE`; the agent consumes still
frames only, never video.

## September 30 cutover

511NY is launching new data feeds on **2026-09-30** and retiring the current
versions, including the **Cameras (XML endpoint)** feed. Access to the new
feeds is granted via a request form starting early September. We requested the
Cameras feed, citing the snapshot and HLS endpoints above.

The new production Cameras feed (`nysdot.carsprogram.org/hub/data/cctv.xml`,
HTTP Basic auth) carries `<video-url>` HLS links again as of 2026-09-29, after
511NY reversed its plan to drop live video. The URLs for our cameras are
unchanged; see [511ny-feed-cutover.md](511ny-feed-cutover.md).

## Platform comparison

| | 511NY | NYC DOT TMC (`webcams.nyctmc.org`) |
| --- | --- | --- |
| Operator | NYSDOT (state traveler-info service) | NYC DOT Traffic Management Center, Long Island City |
| Coverage | Statewide; aggregates NYSDOT + Thruway Authority + NYC DOT via TRANSCOM | Five boroughs only (~1,071 cameras, ~973 online as of 2026-08-19) |
| Status | Official developer platform: registration, developer key, Developer Access Agreement | Undocumented backend of their public map SPA; publicly reachable, unofficial |
| API key | Required (`key={developerKey}`) via user dashboard at [511ny.org/developers/help](https://511ny.org/developers/help) | None |
| Rate limit | 10 calls / 60 seconds (documented) | None documented |
| Still refresh | ~1/minute | Every few seconds (verified: unique JPEG per ~3s poll, `Cache-Control: no-store`) |
| Live video | NYSDOT-owned cameras only — HLS via the `skyvdn.com` CDN | None public; stills only |
| Camera IDs | Small integers (e.g. 5056) | UUIDs |
| Camera metadata | Richer, via data feeds | `id`, `name`, `latitude`, `longitude`, `area`, `isOnline`, `imageUrl` |
| Uptime/SLA | None stated; support channel exists | None; ~9% of cameras offline at time of survey |

### NYC DOT TMC API shape

```
GET https://webcams.nyctmc.org/api/cameras            # all cameras (JSON array)
GET https://webcams.nyctmc.org/api/cameras/{id}       # one camera
GET https://webcams.nyctmc.org/api/cameras/{id}/image # current JPEG still
```

Note `isOnline` is the string `"true"`/`"false"`, not a boolean.

## Key intuitions

- **511NY is a platform; NYCTMC is an exposed backend.** NYCTMC has no docs,
  no versioning, no key, no terms — and no notice before breaking changes
  (the September 30 email is exactly what a platform provides; NYCTMC would
  provide nothing). Fine for experiments; risky as primary infrastructure.
- **Video availability follows camera ownership.** NYSDOT-owned cameras get
  HLS streams plus ~1-minute stills on 511NY; NYC DOT-owned cameras surface
  everywhere as stills only. There are no public NYC DOT live video feeds.
- **The two systems are integrated.** NYCTMC's CSP header includes
  `frame-src https://511ny.org/`, and 511NY's map includes NYC DOT cameras.
- **If polling NYCTMC, self-impose limits** (e.g. one frame per 2s per
  camera, few cameras at once) — there is no published guidance.
- **Possible overlap at our intersection:** NYCTMC lists "12 Ave @ 34 St"
  and "11 Ave @ 34 ST". West Street becomes 12th Avenue near 34th, so the
  former may be at or near View 5056's intersection, offering a ~3s-refresh
  still source as a potential fallback to the HLS stream.

## Sources

- [511NY developer help](https://511ny.org/developers/help)
- [NYSDOT traffic monitoring cameras](https://www.dot.ny.gov/divisions/operating/oom/transportation-systems/systems-optimization-section/ny-moves/traffic-cameras)
- [NYC DOT real-time traffic](https://www.nyc.gov/html/dot/html/motorist/atis.shtml)
- [NYCTMC map](https://webcams.nyctmc.org/map)
- [TCPB Part 2: Scraping Government Data](https://wttdotm.com/blog/tcpb_part_2.html) (community reverse-engineering of the NYCTMC API)
