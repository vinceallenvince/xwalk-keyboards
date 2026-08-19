# Archive

Historical documents kept for reference. Nothing here describes the current
system — see the parent `docs/` folder for live documentation.

- `implementation-plan-hackathon.md` — the original time-boxed hackathon plan
  (2026-08-07). Superseded by `../architecture.md` and the Linear backlog.
- `todo.md` — the hackathon-era feature checklist for the Realtime study;
  everything shipped or was superseded. Open work is tracked in Linear.
- `deployment-record-manual-era.md` — per-release table from the manual
  `gcloud run deploy` era, retired 2026-08-17 when GitHub Actions took over
  (see `../deployment.md`).
- `priority-crosswalk-polygons.json` — hand-drawn crosswalk polygons for the
  Orchestration study's priority snapshot cameras. The Orchestration study
  was removed in 2026-08 (VIN-18/VIN-20) and nothing references this file.
  Realtime stripe geometry now comes from the calibration agent (see
  `../calibration-drift-agent.md`) with hardcoded fallbacks in
  `src/lib/realtime-calibration.ts`.
