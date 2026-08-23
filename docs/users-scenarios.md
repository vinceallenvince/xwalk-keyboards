# Homepage User Scenarios

## Feature: Discover and choose an XWALK KEYBOARDS study

The homepage introduces XWALK KEYBOARDS over a fixed, darkened West Street at
W. 34 St traffic-camera feed, then invites the visitor to choose a study mode.

## Homepage

### As a visitor, I arrive at an immersive XWALK KEYBOARDS homepage

The homepage uses the live West Street at W. 34 St camera as a darkened,
full-viewport canvas. The title and the quiet technical metadata establish the
study before asking the visitor to scroll.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
When the homepage finishes loading
Then a live West Street at W34 Street video feed fills the viewport background
And the video feed remains darkened so foreground content is legible
And the upper-left status indicator reads "FEED LIVE // WEST STREET @ W34 ST"
And the centered hero title displays "XWALK KEYBOARDS"
And the hero title includes the three-line mint visual mark at its left
And a "SCROLL" down-arrow indicator appears below the title
And the lower-left footer reads "NYC DOT // CROSSWALK KEYBOARD STUDY"
And the lower-right footer displays the pattern and study identifiers
```

### As a visitor, I can scroll from the title into the study selector

The title leaves the frame as the visitor scrolls, while the traffic feed
remains fixed behind the interface. The study selector rises into the center of
the viewport in a neutral state, inviting an intentional choice rather than
assuming a default mode.

```gherkin
Given the visitor is viewing the homepage hero
When the visitor scrolls down past the initial hero position
Then the "XWALK KEYBOARDS" title scrolls upward and exits the top of the viewport
And the live traffic-camera background remains fixed in place behind the experience
And the homepage status indicators and footer remain positioned over the fixed background
And the study selector animates upward into the vertical center of the viewport
And the selector presents "REALTIME" and "SEQUENCE" as the available study modes
And "SEQUENCE" displays the subtext "[ In progress ]" beneath the label
And a mint vertical divider separates the two study modes
And "REALTIME" and "SEQUENCE" are rendered in their inactive gray states
```

### As a visitor, I can preview a study mode before choosing it

Both study modes are inactive gray by default. Hovering a mode gives it the
mint highlight and returns the other mode to gray, making the prospective
selection clear before the visitor commits.

```gherkin
Given the study selector is centered in the viewport
When the visitor rolls over "REALTIME"
Then "REALTIME" changes to the active highlight color
And "SEQUENCE" remains in its inactive gray state
And "SEQUENCE" is not a link and does not respond to hover or click
```

## Shared Navigation

### As a visitor, I can return to the XWALK KEYBOARDS homepage

The XWALK KEYBOARDS wordmark in the upper-left is the persistent route back to
the homepage from every study and internal reference page.

```gherkin
Given I am viewing a XWALK KEYBOARDS subpage
When I select the "XWALK KEYBOARDS" wordmark in the upper-left
Then I am returned to the XWALK KEYBOARDS homepage
And the homepage opens in its initial hero state
```

### As a visitor, I can open the About page from the footer

The footer provides a persistent link to the About page from the homepage and
every study subpage. On the About page itself the link is rendered as plain
text. Full About-page scenarios are in the [About](#about) section.

```gherkin
Given I am viewing the XWALK KEYBOARDS homepage or a study subpage
Then the footer includes an "ABOUT" link
When I select the "ABOUT" link
Then I am taken to the About page
```

### As a visitor, I leave a study without its media or audio continuing off-page

Leaving a study ends work that belongs only to that route. A new page must not
inherit live connections, background polling, scheduled audio, or fading notes
from the study that the visitor has left.

```gherkin
Given I am viewing the Realtime study
When I navigate to the homepage, Camera Registry, or another study
Then the prior study's audio is stopped, including any fading notes
And its scheduled audio events are cleared
And its background polling and inference work are stopped
And its live video or WebRTC connections are released when they are no longer needed
And the destination page starts only the connections and work required for its own experience
```

## Realtime Study

### Status vocabulary

The Realtime study carries two independent status lines, and they speak from
two different points of view. The feed line is the camera: `CONNECTING`,
`FEED LIVE`, `FEED RECONNECTING`, `FEED DOWN`. The second line is the
instrument: `KEYBOARD WARMING UP`, `KEYBOARD READY`, `KEYBOARD RECONNECTING`,
`KEYBOARD UNAVAILABLE`, `XWALK KEYBOARD PAUSED`.

A visitor does not need to know that the second line describes a remote GPU
running pedestrian detection, and naming the vendor tells them nothing they can
act on. Naming the instrument tells them exactly what they are waiting for. The
scenarios below quote the instrument vocabulary; the underlying inference state
machine in [`architecture.md`](architecture.md) is unchanged.

The one exception is a camera outage. When the feed itself is down the
instrument line defers to the real cause and reads `FEED UNAVAILABLE` rather
than blaming the keyboard for a failure upstream of it.

### As a visitor, I am told how to hear the crosswalk and receive an update on the crosswalk's current environmental conditions

The Realtime study is silent and still until a pedestrian steps onto the
crosswalk, and its camera connection and keyboard startup are independent
asynchronous cycles that take several seconds. Neither is required to finish
first, and the interface does not imply that one is waiting on the other. A
three-step onboarding sequence runs on every visit, covering that startup
wait: how the instrument is played, what condition the crosswalk is in right
now, and that the keyboard is warming up. Because the sequence appears
immediately, while the camera and inference are still starting, reading it
costs no extra time.

Each step is left-aligned text over the dimmed camera viewport, not a
centered modal card. The copy stays deliberately sparse and names no vendor,
GPU, model, or inference technology. The conditions step derives its readout
from the calibration agent's current status, so the sequence tells the truth
about the instrument before asking the visitor to wait on it. Advancing the
sequence counts as a user gesture for the browser's audio-activation
requirement; the app enables sound automatically when the keyboard
becomes ready.

```gherkin
Given a visitor opens the Realtime study
When the page loads
Then the page header reads "XWALK KEYBOARDS | REALTIME"
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage
And the feed status begins at "CONNECTING // WEST STREET @ W34 ST"
And the inference status begins at "STATUS: KEYBOARD WARMING UP..."
And the camera connection and keyboard startup continue independently behind the overlay
And the onboarding overlay appears over the dimmed camera viewport
And the first step is titled "HOW TO HEAR XWALK KEYBOARDS"
And it explains that each white stripe is a key played by pedestrians crossing
And it explains that the keyboard takes a few seconds to warm up
And it offers a single "NEXT" control
And the "FULLSCREEN" and sound controls are visible but visually inactive
And the source footer reads "NYC DOT CCTV FEED SOURCE // CAMERA ID: 910"
And no spinner or unrelated loading indicator is shown
And the feed and keyboard statuses remain visible and truthful behind the overlay
And the live camera video appears dimmed behind the overlay as soon as the feed is live

When I select "NEXT" on the how-to-hear step
Then the second step is titled "XWALK KEYBOARDS BEST CONDITIONS"
And it explains that keyboard detection works best when the camera has a clear view of the crosswalk
And the conditions readout derives from the calibration agent's current status
And status "ok" renders "Your keyboard conditions: GOOD" with GOOD in mint and no caveat line
And status "degraded" or "needs_review" renders "Your keyboard conditions: FAIR" with FAIR in amber
And status "no_crosswalk" or "feed_down" renders "Your keyboard conditions: BAD" with BAD in red
And FAIR and BAD include the caveat "Bad weather, shadows or obstructions may affect your keyboard's performance."
And when no calibration status is available the readout line is omitted and the caveat line is retained
And the step offers a single "NEXT" control

When I select "NEXT" on the best-conditions step
Then the third step is titled "WARMING UP ..."
And it explains that XWalk Keyboards take a few seconds to a minute to warm up and get started
And it reminds me to check that my speakers are on
And it offers no dismissal control
When the inference status becomes "STATUS: KEYBOARD READY!" while the overlay is still shown
Then the step is titled "KEYBOARD WARMED AND READY!"
And it explains that fine tuning takes just a few seconds
And it still offers no dismissal control
And the overlay copy never contradicts the status bar behind it
When the app receives its first prediction data from the keyboard
Then the onboarding overlay is removed
And the study presents its fully active state

Given prediction data is already arriving when I select "NEXT" on the best-conditions step
Then the warming-up step is skipped
And the onboarding overlay is removed immediately
```

The sequence runs on every visit and never competes with the five-minute
pause modal for the viewport.

```gherkin
Given I have visited the Realtime study before
When the Realtime study opens
Then the onboarding sequence runs again from its first step

Given the five-minute inference pause modal is shown
Then no onboarding step is shown over it
```

### As a visitor, I can reopen the how-to-hear instructions from the header

Once the keyboard is live, the how-to-hear copy stays reachable from a small
info icon beside the study header, so a visitor who arrives at an empty
crosswalk later can confirm that silence is the instrument waiting rather
than the study failing. The icon replays only the first onboarding step —
the conditions and warming-up steps describe a startup that has already
passed.

```gherkin
Given the Realtime study has begun receiving prediction data
Then a small info icon sits to the right of the "XWALK KEYBOARDS | REALTIME" header
And the info icon is not present before the first prediction data arrives

When I select the info icon
Then the "HOW TO HEAR XWALK KEYBOARDS" step reopens alone over the current viewport
And it offers a single "CLOSE" control instead of "NEXT"
And the best-conditions and warming-up steps are not replayed
And the live video, feed status, and inference status continue behind it
And dismissing it with "CLOSE" or Escape returns me to the study unchanged
And reopening the instructions does not restart the camera, inference, or the five-minute inference window
```

The reopened instructions and the five-minute pause modal are never shown at
the same time. The pause modal owns the viewport when it appears, and the
info icon does not summon the instructions over it.

```gherkin
Given the five-minute inference pause modal is shown
Then the instructions are not shown over it
And the info icon is unavailable until the pause modal is dismissed
```

### As a visitor, I can experience the fully active Realtime study

Once the independently-started camera and inference cycles are both active, the
study enables its complete live experience. The page retains its black ground
and quiet technical metadata so the moving image remains the focus.

```gherkin
Given I am on the Realtime study page
And the West Street at W. 34 St camera feed is active
And Roboflow inference is active
When both active states are available at the same time
Then the page header reads "XWALK KEYBOARDS | REALTIME"
And the feed status reads "FEED LIVE // WEST STREET @ W34 ST"
And the inference status reads "STATUS: KEYBOARD READY!"
And the live camera video fills the reserved central viewport
And the "FULLSCREEN" control is available at the lower-right of the viewport
And the sound control is available beside it and indicates its current sound state
And the source footer reads "NYC DOT CCTV FEED SOURCE // CAMERA ID: 910"
```

### As a visitor, I can see and hear pedestrians play the Realtime crosswalk

When Realtime inference is active, the live image distinguishes pedestrians by
whether they are in the calibrated crosswalk. Only people inside the crosswalk
become part of the instrument. The visual response belongs to the painted
crosswalk stripe, not to a floating marker above the pedestrian.

The crosswalk is one continuous keyboard. Notes climb chromatically from the
left-most detected stripe to the right-most, straight across the median — a
pedestrian walking the full crossing walks up the scale. The median itself is
not part of the instrument: standing between the two crosswalk runs plays
nothing.

```gherkin
Given I am viewing an active Realtime study
And the West Street at W. 34 St camera feed and Roboflow inference are active
When a pedestrian is detected inside the calibrated crosswalk
Then the app maps the pedestrian's position to the corresponding crosswalk stripe
And the left-most white stripe maps to the piano note "C4"
And each stripe to the right maps to the next piano key, continuing across the median
And a pedestrian standing on the median between crosswalk runs triggers no note
And the occupied crosswalk stripe is highlighted in the live video
And no floating pedestrian triangle appears in the live video
And the app plays the note corresponding to the occupied stripe
And the note is audible when the sound control reads "SOUND ON"
When a pedestrian is detected outside the calibrated crosswalk
Then no crosswalk stripe is highlighted for that pedestrian
And that pedestrian does not trigger a note
When no pedestrians are detected inside the calibrated crosswalk
Then the Realtime study does not play a crosswalk note
```

### As a visitor, I hear a keyboard that may be tuned differently than last time

The crosswalk is re-read every few minutes, and how much of it the camera can
see changes with traffic, weather, and light. Which note a given painted stripe
plays is therefore not fixed — a stripe hidden by a truck renumbers the ones
after it, shifting the run. The study does not defend against this: it is an
instrument, not a measurement, and an ascending scale that begins somewhere new
is still an ascending scale. What is guaranteed is that the keys sit on the
paint and the run always ascends left to right.

```gherkin
Given the crosswalk has been recalibrated since I last played it
When a pedestrian steps on the same painted stripe as before
Then it may play a different note than it did before
And the crosswalk still plays an ascending chromatic run from left to right
And no error or degraded state is shown, because this is normal operation
```

### As a visitor, I can understand and recover from a Realtime connection loss

The camera feed and inference connection remain independent after startup as
well as before it. A failure in either one is communicated honestly, while the
other continues whenever it is still available.

```gherkin
Given I am viewing an active Realtime study
When the live camera connection is lost
Then the feed status no longer presents the camera as live
And the page visibly communicates that the camera is reconnecting
And no new crosswalk notes or stripe highlights are produced until a current camera frame is available
And the inference connection is not restarted solely because the camera connection was lost
When the camera connection recovers
Then the current live video resumes
And crosswalk highlights and qualifying notes resume only from current detections

Given I am viewing an active Realtime study
When the Roboflow inference connection is lost
Then the live camera video continues when its connection remains available
And the inference status no longer presents the keyboard as ready
And no new crosswalk notes or stripe highlights are produced while inference is unavailable
And no stale stripe highlight remains over the moving video
And the camera connection is not restarted solely because inference was lost
When the inference connection recovers
Then the inference status becomes active again
And crosswalk highlights and qualifying notes resume from new detections
```

### As a visitor, if the video feed is unavailable, I see a confirmation message

When the camera feed cannot be reached or the calibration agent reports that
the feed is down, the study communicates honestly rather than showing a blank
viewport or pretending the instrument is available.

```gherkin
Given I am viewing the Realtime study
When the camera feed is unavailable due to a source outage or network failure
Then the feed status reads "FEED DOWN // WEST STREET @ W34 ST" in its inactive state
And the inference status reads "FEED UNAVAILABLE" in red
And the viewport displays the last received frame darkened to 35% opacity
And a centered overlay reads "VIDEO FEED UNAVAILABLE" in bold 18px white
And a subtitle reads "The camera feed for this intersection is currently offline."
And the FULLSCREEN and SOUND controls remain visible but visually inactive at reduced opacity
And no crosswalk stripe highlights or notes are produced
And an operator can still trigger a manual calibration check from the debug panel
When the camera feed recovers
Then the study resumes its normal live state with current detections
And the unavailable overlay is removed
```

### As a visitor, if the camera has rotated away from the crosswalk, I am redirected to another camera

511NY cameras rotate through preset views on an unknown schedule. When a
camera rotates away from the crosswalk, the calibration agent publishes a
zero-stripe calibration (`stripes: []`, `status: no_crosswalk`). The live
video feed still works — the camera is up — but there is no crosswalk in
frame and therefore no keyboard to play.

This is not an error state. It is a temporary viewport rotation, and the
study communicates it as a redirect opportunity rather than a failure. The
onboarding sequence does not run; the visitor goes straight to the redirect
notice because there is nothing to warm up.

```gherkin
Given I open the Realtime study for a camera
And the calibration agent's current calibration has status "no_crosswalk" and an empty stripes array
When the page loads
Then the feed status reads "FEED LIVE // <CAMERA INTERSECTION>" with a live mint dot
And the inference status reads "STATUS: KEYBOARD UNAVAILABLE"
And the live camera video is visible at reduced opacity behind the notice
And a centered notice appears over the viewport
And the notice title reads "NO CROSSWALK DETECTED"
And the notice explains that this camera is not currently showing a crosswalk
And the notice presents links to the other registered realtime cameras, excluding the current one
And each camera link is labeled with the camera ID (e.g., "CAM 5059")
And each camera link navigates to that camera's realtime page (e.g., /realtime/5059)
And the "FULLSCREEN" and sound controls remain visible but visually inactive
And no onboarding sequence runs because there is no keyboard to warm up
And no crosswalk stripe highlights or notes are produced
```

The notice is not a modal with a dismiss action — there is no useful state
behind it to return to. The visitor either navigates to another camera or
waits for the camera to rotate back.

```gherkin
Given the camera-rotated notice is displayed
When the calibration agent publishes a new calibration with one or more stripes
Then the notice is removed
And the onboarding sequence begins from its first step
And the study proceeds through its normal startup flow
And no manual page reload is required
```

The existing five-minute re-fetch cycle handles recovery: the client polls
the calibration JSON, and when stripes reappear the notice auto-dismisses
and onboarding begins.

```gherkin
Given all registered cameras have status "no_crosswalk"
When I view the camera-rotated notice
Then the notice still lists the other cameras as links
And no "all cameras unavailable" special state is shown
And a visitor who navigates to another camera sees its own camera-rotated notice
```

The notice and the five-minute pause modal are never shown at the same time.
The camera-rotated state takes precedence: if there is no crosswalk in frame,
there is no inference to pause.

```gherkin
Given the camera-rotated notice is displayed
Then the five-minute inference timer is not started
And no pause modal is shown
And no inference connection is opened

Given inference is active and the five-minute timer is running
When a recalibration arrives with status "no_crosswalk" and empty stripes
Then inference is stopped
And the pause modal is not shown
And the camera-rotated notice appears
And the five-minute timer is cleared
```

The conditions step in the onboarding sequence reflects the zero-stripe
state honestly when it runs on a subsequent visit after recovery.

```gherkin
Given the calibration status is "no_crosswalk"
And the onboarding sequence has not yet run because the notice was shown instead
When the calibration recovers and onboarding begins
Then the conditions step derives from the recovered calibration's status, not the prior "no_crosswalk"
```

### As a visitor, I can view the live Realtime study full screen

Fullscreen removes the surrounding study interface and makes the live camera
feed the entire experience, while preserving only minimal operational metadata
and a clear way to return.

```gherkin
Given I am viewing an active Realtime study camera feed
When I activate the "FULLSCREEN" control
Then the live video expands to fill the viewport edge to edge
And the surrounding page header, controls, and source footer are hidden
And an exit hint reads "CLICK ANYWHERE OR PRESS ESC TO EXIT"
When I click anywhere in the fullscreen view or press Escape
Then fullscreen mode closes
And I return to the active Realtime study page with its controls and metadata restored
```

## Inference Management

Inference uses a shared GPU resource with a limited monthly budget. These
scenarios govern how the app manages that budget without degrading the
first-visit experience.

### As a visitor, I experience uninterrupted inference for the first five minutes

The first five minutes of inference are uninterrupted — no modal, no
countdown, no degradation. This is the window in which the study makes its
impression, and it must feel like a live instrument, not a metered service.

```gherkin
Given I have opened the Realtime study and inference is active
When I have been viewing for less than five minutes
Then inference, stripe highlights, and audio operate normally
And no usage indicator, countdown, or modal is shown
And the five-minute timer is not visible to the visitor
```

### As a visitor, after five minutes I am asked whether to continue

After five minutes the app pauses inference and presents a modal. The live
video continues behind it so the page does not go blank. The modal is a
respectful interruption, not an error state — the study worked, and the
visitor is invited to continue if they choose.

```gherkin
Given I have been viewing the Realtime study with active inference for five minutes
When the five-minute threshold is reached
Then the WebRTC inference connection is paused
And crosswalk stripe highlights and audio stop
And the live camera video continues playing behind the modal
And a centered modal appears over the viewport
And the modal title reads "XWALK KEYBOARD PAUSED"
And the modal explains that the XWalk Keyboard has been paused to conserve resources
And the modal offers a "CONTINUE" button and a "CLOSE" button
And the SOUND ON / FULLSCREEN controls remain visible but inactive

When I select "CONTINUE"
Then the modal closes
And inference restarts with a fresh WebRTC connection
And stripe highlights and audio resume from current detections
And the five-minute timer resets so I receive another full five-minute window

When I select "CLOSE"
Then the modal closes
And the live camera video continues without inference
And no stripe highlights or audio are produced
And the inference status reads "XWALK KEYBOARD PAUSED: RELOAD TO CONTINUE"
And the visitor may reload the page to start a new five-minute session
```

### As a visitor, if inference fails during my five-minute window, recovery is transparent

Infrastructure failures (GPU worker death, network interruption) during the
five-minute window are handled by automatic retry. The five-minute timer
continues counting during recovery — a hiccup does not buy extra time, but
it also does not penalise the visitor by showing the pause modal early.

```gherkin
Given I am viewing the Realtime study within the five-minute window
When the Roboflow inference connection fails
Then the app reconnects automatically with exponential backoff
And the inference status shows the retry attempt number
And the five-minute timer continues counting during reconnection
And no modal is shown unless all retry attempts are exhausted
When all retry attempts are exhausted
Then the inference status reads "STATUS: KEYBOARD UNAVAILABLE"
And no pause modal is shown because the failure is an infrastructure problem, not a usage limit
```

### As a visitor, if GPU credits are exhausted, I see an honest message

A 402 (Payment Required) from Roboflow means the monthly GPU budget is
spent. This is not a transient failure and retrying will not help. The app
communicates honestly and does not show the "Continue" modal because there
is nothing to continue.

```gherkin
Given I am viewing the Realtime study
When Roboflow returns a 402 Payment Required error
Then the app does not retry
And the inference status reads "STATUS: KEYBOARD UNAVAILABLE"
And the live camera video continues without inference
And no pause modal or retry countdown is shown
And the visitor understands this is a resource limit, not a broken feature
```

## About

### As a visitor, I can learn about XWALK KEYBOARDS

The About page is the project's public-facing description. The live West Street
at W. 34 St camera feed fills the page background — the same feed the homepage
uses — making the About page feel like part of the instrument rather than a
static informational document. The project description sits inside a dark
viewport panel that preserves legibility over the moving video.

The copy is a single paragraph. It explains what the crosswalk piano does
without naming vendors, models, or inference technology.

```gherkin
Given I open the XWALK KEYBOARDS About page
When the page loads
Then the header reads "XWALK KEYBOARDS | ABOUT"
And the ABOUT label is rendered as plain text, not underlined, because I am already on the About page
And a feed status reads "CONNECTING // WEST STREET @ W34 ST" with an inactive status dot
And a dark viewport panel is visible below the feed status
And the viewport contains a single paragraph explaining that XWalk Keyboards transforms crosswalks into piano keyboards
And the paragraph mentions that pedestrians step on white stripes and the app plays the corresponding notes
And the paragraph is set in 12px monospace
And no section headings, study links, or eyebrow labels are shown
And the footer reads "SOURCE: 511NY // ABOUT" with ABOUT as plain text, not a self-link
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage

When the camera feed becomes active
Then the feed status reads "FEED LIVE // WEST STREET @ W34 ST" with a live mint dot
And the live camera video fills the page background at reduced opacity
And the viewport panel remains dark and legible over the moving video
And the camera feed is visible around the viewport edges and behind the footer
And no inference, stripe highlights, or audio are started — the feed is ambient only
```

### As a visitor, I can reach the About page from any footer

The About link replaces the former Camera Registry link in the footer. It
appears on every page except the About page itself, where it is rendered as
plain text to avoid a self-referential link.

```gherkin
Given I am viewing the XWALK KEYBOARDS homepage
Then the fixed footer includes an "ABOUT" link styled in mint
When I select the "ABOUT" link
Then I am taken to the About page

Given I am viewing a study subpage (Realtime)
Then the footer includes an "ABOUT" link
When I select the "ABOUT" link
Then I am taken to the About page

Given I am viewing the Camera Registry
Then the footer includes an "ABOUT" link
When I select the "ABOUT" link
Then I am taken to the About page

Given I am viewing the About page
Then the footer reads "SOURCE: 511NY // ABOUT"
And "ABOUT" is plain text, not a link
```

## Camera Registry

### As a user, I can review every registered camera and its fallback coverage

The internal camera-registry page makes the curated static-camera inventory
visible at a glance while retaining a vertical column of live video feeds for
operational reference. It is a diagnostic and curation surface, not a
participant-facing study view.

```gherkin
Given I open the internal XWALK KEYBOARDS camera-registry page
When the page loads
Then I see a "Priority cameras" grid containing every camera in the priority registry
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage
And I see a separate "Fallback cameras" grid containing every configured fallback camera
And priority cameras appear before fallback cameras in the page reading order
And each static-camera card displays a single current snapshot from its registered image feed
And each priority camera card is labeled "Camera <index> · View <id>"
And each fallback camera card is labeled "Camera <index> · View <id>"
And each card includes its internal camera identifier beneath the label
And each card includes a direct link to via a UI button to "https://511ny.org/map/Cctv/<id>"
And a camera that is unavailable or under maintenance remains visible in its registered position
And an unavailable camera uses its returned unavailable-image state rather than disappearing from the grid
And the page does not invoke Roboflow inference for these registry snapshots
And the page shows a vertical list of live video feeds in a right column
And each live-feed entry remains independently visible so the team can compare its current stream state
```

## Developer tools

### As an operator, I can inspect calibration and inference state from the debug panel

The Realtime study includes a debug panel toggled by Ctrl+Shift+D. It is
invisible in normal use and does not affect the visitor experience. The
panel shows live calibration data and provides operator actions for
diagnosing drift, testing failure states, and triggering manual
recalibration.

The cluster counts are a link to the archived frame that calibration was read
from. A missing stripe usually explains itself the moment the frame is in front
of you — pedestrians standing on the paint suppress the detections underneath
them, so a gap in the keyboard often lines up with a group mid-crossing. The
link opens the frame in Google Cloud Storage and so requires an operator signed
in with read access to the calibration bucket; it is absent when the run
archived no frame, and when the study is running on its baked-in reference
rather than a published calibration.

```gherkin
Given I am viewing the Realtime study
When I press Ctrl+Shift+D
Then a debug panel appears over the viewport
And the panel header reads "CALIBRATION DEBUG"
And the panel displays the calibration source (live or reference)
And the panel displays the calibration status, reasoning, updatedAt, and stripe count
And the panel displays the stripe count per cluster and the keyboard's note range
And the cluster counts link to the camera frame the calibration was measured from
And the panel displays the crosswalk hull point counts per cluster
And the panel displays the current video frame dimensions
And a RENDER POLYGONS button toggles an overlay of all stripe outlines and boundary quads over the feed
And a FORCE UNAVAILABLE button puts the camera into the unavailable state for testing
And a FORCE PAUSE MODAL button triggers the five-minute inference pause modal
And a RECALIBRATE button captures the current frame and runs the calibration agent against it
And the RECALIBRATE button shows "CALIBRATING..." while the request is in flight

When I press Ctrl+Shift+D again
Then the debug panel closes
And the polygon overlay is retained independently if it was toggled on
```

### As an operator, I can review GPU startup timing from the debug panel

The debug panel includes a STARTUP TIMING section that shows the latency
breakdown for the most recent Roboflow GPU connection attempt. This data
helps diagnose whether slow startups are caused by config loading, HLS
playback, GPU provisioning, or the gap between GPU ready and first
predictions.

```gherkin
Given the debug panel is open
And a GPU startup attempt has completed (success or failure)
Then a "STARTUP TIMING" section appears in the debug panel
And it displays the attempt outcome (success, failed, or in-progress)
And it displays the session type (initial, retry, stall-reconnect, or pause-continue)
And it displays the connection key and retry count
And it displays which milestone the attempt reached
And it displays time to GPU ready as a human-readable duration
And it displays time to predictions as a human-readable duration
And it displays the prediction lag (GPU ready to first predictions)
And it displays the perceived latency (page mount to first predictions)
And durations that were not reached display "—"
```

### As an operator, I can observe GPU startup timing in the browser console

Each startup attempt emits one structured log line to the browser console
when it terminates — either on first predictions or on a terminal failure.
The line is namespaced `[xwalk]` and includes the outcome, session type,
retry count, reached stage, and all available durations. No log line is
emitted per frame.

```gherkin
Given I am viewing the Realtime study with the browser console open
When the GPU startup attempt receives its first prediction data
Then the console shows one "[xwalk] startup:" info line
And the line includes outcome=success and the derived durations in milliseconds
And no additional startup log lines are emitted on subsequent prediction frames

Given the GPU startup attempt fails terminally (quota exhausted or retries exhausted)
Then the console shows one "[xwalk] startup:" info line with outcome=failed
And the line includes the reached stage indicating where the attempt died
```

### GPU startup timing is reported server-side for aggregation

Each startup attempt beacons its timing summary to the server via
`sendBeacon` so latency data can be aggregated across all visitors.
The beacon fires at the same points as the console log — once per
attempt, never per frame.

```gherkin
Given the GPU startup attempt completes (success or failure)
Then a sendBeacon POST is sent to /api/telemetry/startup
And the payload is the StartupSummary JSON (durations, statuses, counts only — no PII)
And the server validates the payload schema and writes a structured JSON log line to stdout
And Cloud Logging receives the log entry for dashboarding

Given sendBeacon is unavailable or the POST fails
Then the failure is silently ignored
And the study continues normally
```
