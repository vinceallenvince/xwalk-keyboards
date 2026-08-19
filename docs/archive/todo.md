# XWALK KEYBOARDS TODO

XWALK KEYBOARDS turns NYC crosswalk cameras into playable pianos. 

## Realtime study

- [x] If pedestrians are detected but none are inside either crosswalk, play a beat. Stop the beat as soon as any pedestrian enters a crosswalk. If no pedestrians enter the crosswalk for 20 seconds, start the beat again. 
- [x] Replace the hard-bordered polygon stripe highlight with a softer glow effect — the current `rgba(148,215,181,0.42)` filled polygon with a sharp outline reads as a debug overlay rather than an instrument responding to a player. Consider a radial gradient, a blur filter, or a bloom/feathered edge that makes the stripe light up rather than get outlined.
- [x] Add a debug menu toggled by a keystroke (e.g. `Ctrl+Shift+D` or backtick) that displays the latest calibration agent data: status, reasoning, conditions, stripe count, confidence, updatedAt, and source (live vs reference). Useful for diagnosing calibration drift without opening the browser console or calling the API directly. Should be invisible in normal use. The debug menu should also provide a button called RENDER POLYGONS that toggles an overlay of the polygon shapes that we can use to visually confirm that they are accurate.
- [x] Design the Realtime page's behaviour when the calibration agent returns `no_crosswalk` or `feed_down`. The current architecture surfaces these as a `calibration.status` from the `useCalibration` hook, but no UI exists to render them. Need a Figma design for both states — the study should not pretend the instrument is working when the crosswalk is gone or the feed is down. Candidates: a full-viewport message replacing the camera feed, or a persistent banner over the existing feed with an explanation drawn from the agent's `reasoning` field.
- [x] Add a RECALIBRATE button to the right of FEED LIVE // WEST STREET @ W34 ST that triggers the calibration agent manually
- [x] Add a GPU usage throttle to protect Roboflow credits. After 5 minutes of active inference, pause the WebRTC connection and show a modal asking the user if they'd like to continue. If yes, restart inference and reset the 5-minute timer. If no (or no response), keep the video playing but stop inference and audio. This is the minimum viable approach to expose the app publicly without risking credit exhaustion from tabs left open. A more sophisticated strategy (per-session budgets, concurrent-user caps, time-of-day scheduling) can follow once usage patterns are visible in the Looker Studio dashboard.
- [x] ~~Deploy the web app on Vercel at xwalkkeyboards.app~~ (superseded — deployed to Cloud Run via GitHub Actions; see `deployment.md`)
- [ ] Create a README with a screenshot and a link to the deployed app
- [x] Add an About subpage and replace CAMERA REGISTRY link with ABOUT
- [x] Replace ORCHESTRATION link on homepage with SEQUENCE and subtext, "[ In progress ]" (the /orchestration route was later removed — VIN-20) 
- [x] Move RECALIBRATE button to debug menu

