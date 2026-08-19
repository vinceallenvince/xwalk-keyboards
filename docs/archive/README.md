# Archive

Historical documents kept for reference. Nothing here describes the current
system — see the parent `docs/` folder for live documentation.

- `implementation-plan-hackathon.md` — the original time-boxed hackathon plan
  (2026-08-07). Superseded by `../architecture.md` and the Linear backlog.
- `priority-crosswalk-polygons.json` — hand-drawn crosswalk polygons for the
  Orchestration study's priority snapshot cameras. The Orchestration study
  was removed in 2026-08 (VIN-18/VIN-20) and nothing references this file.
  Realtime stripe geometry now comes from the calibration agent (see
  `../calibration-drift-agent.md`) with hardcoded fallbacks in
  `src/lib/realtime-calibration.ts`.
