# Offline HLS fixture

`playlist.m3u8` and `segment-000000.mpegts` are a finite four-second,
352 x 240 H.264/MPEG-TS presentation captured from the configured View 5056
traffic-camera source on 2026-09-13.

The Camera Registry e2e spec serves these files at every registered camera's
same-origin HLS paths. This exercises the browser's real hls.js parsing,
transmuxing, playback, and cleanup without contacting 511NY or the City of
Bellevue during a test run. The scene content is immaterial to these transport
lifecycle tests.
