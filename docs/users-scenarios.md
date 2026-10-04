# Homepage User Scenarios

## Feature: Discover and choose an XWALK KEYBOARDS study

The homepage introduces XWALK KEYBOARDS over a fixed, darkened live
traffic-camera feed, then invites the visitor to choose a camera.

### Camera placeholders

Live cameras come from more than one public provider (511NY in New York,
the City of Bellevue in Washington, and a private CARLA simulation), so
scenarios that apply to every camera use a placeholder rather than one
intersection's copy:

- `<CAMERA STATUS LABEL>` — the camera's short status-bar name, for example
  `WEST STREET @ W23 ST` (CAM 5059, New York) or
  `BELLEVUE WAY @ NE 8TH ST` (CAM 80007, Bellevue, WA).

Visitor-facing copy does not credit a camera provider. The status line names
the intersection; the footer credits only the tools that power the site.

The homepage and About backgrounds use 511NY's West Street at W. 23 St camera
(CAM 5059). Any camera whose feed goes down drops out of navigation until it
comes back.

## Homepage

### As a visitor, I arrive at an immersive XWALK KEYBOARDS homepage

The homepage uses the live West Street at W. 23 St camera (CAM 5059) as a
darkened, full-viewport canvas. The title and the quiet technical metadata
establish the study before asking the visitor to scroll.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
When the homepage finishes loading
Then a live West Street at W. 23 St video feed fills the viewport background
And the video feed remains darkened so foreground content is legible
And the upper-left status indicator reads "FEED LIVE // WEST STREET @ W23 ST"
And the centered hero title displays "XWALK KEYBOARDS"
And the hero title includes the three-line mint visual mark at its left
And a "SCROLL" down-arrow indicator appears below the title
And the footer reads "ABOUT // POWERED BY: Roboflow + Google Cloud Run"
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
And the camera selector animates upward into the vertical center of the viewport
And the selector presents one link for each registered live camera
And a mint vertical divider separates each pair of camera links
And all camera links are rendered in their inactive gray states
```

### As a visitor, I can preview a camera link before choosing it

All camera links are inactive gray by default. Hovering a link gives it
the mint highlight and returns the others to gray, making the prospective
selection clear before the visitor commits.

```gherkin
Given the camera links section is centered in the viewport
When the visitor rolls over "CAM 80007"
Then "CAM 80007" changes to the active mint highlight color
And the other camera links remain in their inactive gray state
When the visitor rolls over a different camera link
Then that link receives the mint highlight
And "CAM 80007" returns to its inactive gray state
```

### As a visitor, I see dynamic camera links on the homepage

The homepage fetches
calibration data for all registered live cameras on load and shows a link
for each camera whose crosswalk is currently visible. Links are ordered
left to right best crosswalk first, by the calibration agent's crosswalk
rank; cameras with equal rank are ordered by descending camera ID.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
And all six listed live cameras (90014, 80007, 5072, 5062, 5059, 5056) have a calibration status other than "no_crosswalk" or "feed_down"
And all six share the same crosswalk rank
When the homepage finishes loading and calibration statuses have been fetched
Then six camera links are displayed in descending order by camera ID (CAM 90014 | CAM 80007 | CAM 5072 | CAM 5062 | CAM 5059 | CAM 5056)
And a mint vertical divider separates each pair of camera links
And each link navigates to that camera's Realtime page
```

```gherkin
Given the camera links section is visible
When the visitor selects "CAM 80007"
Then the visitor navigates to /realtime/80007
And the Realtime study opens with its normal onboarding sequence for camera 80007
```

### As a visitor, I'm never offered an unlisted camera

A registered camera can be unlisted: it has a working Realtime page, stream,
and calibration, but navigation doesn't suggest it. Bellevue cameras 80003,
80009, and 80027 are unlisted (VIN-86) and are listed by hand if and when
they're wanted in navigation. Unlisted cameras never
appear in the homepage camera links or in the "NO CROSSWALK DETECTED"
notice's links, whatever their status. Their pages stay reachable by URL.

```gherkin
Given cameras 80003, 80009, and 80027 are unlisted
And every registered live camera, listed or not, has calibration status "ok" and equal crosswalk rank
When the homepage finishes loading
Then the camera links section displays six links: "CAM 90014 | CAM 80007 | CAM 5072 | CAM 5062 | CAM 5059 | CAM 5056"
And no link for camera 80003, 80009, or 80027 is shown

Given camera 80003 is unlisted
When a visitor opens /realtime/80003 directly
Then the Realtime study opens for camera 80003 as it would for any listed camera
```

### As a visitor, camera links appear only once availability is known

The homepage doesn't show a camera link until it knows whether that camera
is available. While the calibration statuses are loading, the selector stays
empty but keeps its space, so the page doesn't shift when the links arrive.
The links then appear once, already filtered and in their final order. A
visitor never sees, or clicks, a camera that is about to be hidden.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
And calibration statuses have not yet been fetched
When the visitor scrolls to the camera selector
Then no camera links are displayed
And the camera selector keeps its space in the layout
And the rest of the homepage renders normally, including the background video, status line, and footer

Given calibration statuses have not yet been fetched
And cameras 5072, 5062, 5059, and 5056 will report status "feed_down"
When the calibration statuses arrive
Then the camera links appear: "CAM 90014 | CAM 80007"
And no link for a camera whose feed is down was displayed at any point
And the page layout does not shift when the links appear
```

If the statuses can't be fetched (a network error, a non-OK response, or
unreadable data), the homepage falls back to the default camera, CAM 5059.
Its feed is the one already playing behind the homepage, so the visitor
still has somewhere to go. The homepage uses the same fallback when the
statuses arrive but every feed is down (see "cameras whose feed is down are
hidden from the homepage links").

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
When the calibration status request fails
Then the camera links section displays one link: "CAM 5059"
And no other camera link is shown
And selecting "CAM 5059" navigates to /realtime/5059
```

### As a visitor, cameras with no crosswalk are hidden from the homepage links

When a camera has rotated away from its crosswalk, its calibration status
reads `no_crosswalk`. The homepage excludes that camera's link so visitors
are not sent to a page with nothing to play. If only one camera has a
crosswalk, only one link appears.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
And camera 5059 has calibration status "no_crosswalk"
And cameras 90014, 80007, 5072, 5062, and 5056 have calibration status "ok" and equal crosswalk rank
When the homepage finishes loading
Then the camera links section displays five links: "CAM 90014 | CAM 80007 | CAM 5072 | CAM 5062 | CAM 5056"
And no link for camera 5059 is shown
And the remaining links keep their crosswalk-rank, then camera-ID order
```

### As a visitor, cameras whose feed is down are hidden from the homepage links

A camera whose live stream cannot be reached reports `feed_down`. This is
how an individual 511NY stream looks while it's offline, sometimes for
days at a time. While any feed is up, the homepage never links to a camera
with no video, even when that leaves only one link.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
And cameras 5072, 5062, 5059, and 5056 have status "feed_down"
And cameras 90014 and 80007 have calibration status "ok" and equal crosswalk rank
When the homepage finishes loading
Then the camera links section displays two links: "CAM 90014 | CAM 80007"
And no link is shown for any camera whose feed is down
```

If every feed is down, the homepage doesn't show an empty selector. It
falls back to the default camera, CAM 5059, the same fallback it uses when
the statuses can't be fetched. Its Realtime page then tells the visitor
honestly that the feed is offline.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
And every registered live camera has status "feed_down"
When the homepage finishes loading
Then the camera links section displays one link: "CAM 5059"
And no other camera link is shown
When the visitor selects "CAM 5059"
Then the visitor navigates to /realtime/5059
And the visitor sees the "VIDEO FEED UNAVAILABLE" notice on arrival
```

### As a visitor, I still see camera links when every camera is rotated

The homepage always gives the visitor somewhere to go. When every
camera with a working feed has rotated away from its crosswalk, the link
section renders those cameras rather than showing an empty selector.
A camera whose feed is down is never restored this way: a rotated camera
still has video to show, but a down camera has nothing. Only when every
feed is down does the homepage fall back to CAM 5059 (see the previous
story).

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
And every registered live camera whose feed is up has calibration status "no_crosswalk"
When the homepage finishes loading
Then the camera links section displays a link for every camera whose feed is up
And no link is shown for a camera whose feed is down
And the visitor always has somewhere to go while any feed is up
And selecting a camera link navigates to that camera's Realtime page
And the visitor sees that camera's "NO CROSSWALK DETECTED" notice on arrival
```

### As a visitor, the camera links reflect the state at page load

The homepage fetches calibration statuses once when the page loads. The
link list does not update dynamically while the visitor is on the page —
a camera that recovers or rotates away after the fetch is reflected on the
next visit or browser refresh.

```gherkin
Given the visitor is viewing the homepage
And camera 5072 had calibration status "no_crosswalk" at page load
When camera 5072 recovers its crosswalk while the visitor is still on the homepage
Then the camera links section does not change
And camera 5072's link does not appear until the visitor refreshes or returns to the homepage

Given the visitor is viewing the homepage
And all registered cameras had available crosswalks at page load
When camera 5056 rotates away while the visitor is still on the homepage
Then the camera links section does not change
And camera 5056's link remains visible until the visitor refreshes or returns to the homepage
```

### As a visitor, the background video stream is independent of crosswalk availability

The homepage background video is ambient — it plays camera 5059's live
feed for visual atmosphere, not for inference. The background stream
continues regardless of whether camera 5059's crosswalk is available.

```gherkin
Given camera 5059 has calibration status "no_crosswalk"
When the homepage loads
Then the West Street at W. 23 St background video stream plays normally
And the background video remains darkened as ambient visual atmosphere
And no inference, stripe highlights, or audio are started on the homepage
And the feed status still reads the camera's connection state (e.g., "FEED LIVE // WEST STREET @ W23 ST")

Given camera 5059 has calibration status "ok"
When the homepage loads
Then the background video stream behaves identically
And the background stream is always ambient, regardless of calibration status
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

### As a visitor, the footer credits the tools that power the site

Live cameras come from more than one provider, so the footer names none of
them. It carries the About link and the tools the instrument runs on, and it
reads the same on every page and at every viewport width.

```gherkin
Given I am viewing the homepage, a Realtime study page, or the About page
Then the footer reads "ABOUT // POWERED BY: Roboflow + Google Cloud Run"
And "ABOUT", "Roboflow", and "Google Cloud Run" are mint links
And "//", "POWERED BY:", and "+" are gray
And "Roboflow" and "Google Cloud Run" open their sites in a new tab
And the footer names no camera provider (no "CAM SOURCE", "511NY", or "BELLEVUE")

Given I am viewing the footer on a mobile viewport
Then it reads the same "ABOUT // POWERED BY: Roboflow + Google Cloud Run"
And the "POWERED BY" credits are not hidden

Given I am viewing the About page
Then "ABOUT" is plain text rather than a link
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

The feed line always names the camera being played with its
`<CAMERA STATUS LABEL>` (see [Camera placeholders](#camera-placeholders)).
A visitor who opens `/realtime` without a camera ID gets the default camera,
West Street at W. 23 St (CAM 5059).

```gherkin
Given a visitor opens /realtime with no camera ID
Then the Realtime study opens for camera 5059
And the feed status begins at "CONNECTING // WEST STREET @ W23 ST"
```

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
And the feed status begins at "CONNECTING // <CAMERA STATUS LABEL>"
And the inference status begins at "STATUS: KEYBOARD WARMING UP..."
And the camera connection and keyboard startup continue independently behind the overlay
And the onboarding overlay appears over the dimmed camera viewport
And the first step is titled "HOW TO HEAR XWALK KEYBOARDS"
And it explains that each white stripe is a key played by pedestrians crossing
And it explains that the keyboard takes a few seconds to warm up
And it offers a single "NEXT" control
And the "FULLSCREEN" and sound controls are visible but visually inactive
And the footer reads "ABOUT // POWERED BY: Roboflow + Google Cloud Run"
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
And the camera feed is active
And Roboflow inference is active
When both active states are available at the same time
Then the page header reads "XWALK KEYBOARDS | REALTIME"
And the feed status reads "FEED LIVE // <CAMERA STATUS LABEL>"
And the inference status reads "STATUS: KEYBOARD READY!"
And the live camera video fills the reserved central viewport
And the "FULLSCREEN" control is available at the lower-right of the viewport
And the sound control is available beside it and indicates its current sound state
And the footer reads "ABOUT // POWERED BY: Roboflow + Google Cloud Run"
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
And the camera feed and Roboflow inference are active
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
Then the feed status reads "FEED DOWN // <CAMERA STATUS LABEL>" in its inactive state
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

Traffic cameras rotate through preset views on an unknown schedule. When a
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
And the notice presents links to the other listed realtime cameras, excluding the current one and any unlisted camera
And each camera link is labeled with the camera ID (e.g., "CAM 80007")
And each camera link navigates to that camera's realtime page (e.g., /realtime/80007)
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

The modal is rendered inside the fullscreen container so it works in both
native fullscreen and mobile pseudo-fullscreen without exiting. In
pseudo-fullscreen the "tap anywhere to exit" layer is hidden while the
modal is showing so the visitor cannot accidentally leave fullscreen by
tapping the scrim behind the buttons.

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

Given I am in native fullscreen when the five-minute threshold is reached
Then the modal appears inside the fullscreen viewport
And fullscreen mode is not exited
And the modal scrim and buttons are fully visible and interactive

Given I am in pseudo-fullscreen (mobile) when the five-minute threshold is reached
Then the modal appears inside the pseudo-fullscreen viewport
And the "tap anywhere to exit" layer is hidden so it does not intercept modal taps
And fullscreen mode is not exited

When I select "CONTINUE"
Then the modal closes
And inference restarts with a fresh WebRTC connection
And stripe highlights and audio resume from current detections
And the five-minute timer resets so I receive another full five-minute window
And fullscreen mode remains active if it was active before the pause

When I select "CLOSE"
Then the modal closes
And the live camera video continues without inference
And no stripe highlights or audio are produced
And the inference status reads "XWALK KEYBOARD PAUSED: RELOAD TO CONTINUE"
And the visitor may reload the page to start a new five-minute session
And fullscreen mode remains active if it was active before the pause
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

The About page is the project's public-facing description. The live West
Street at W. 23 St camera feed (CAM 5059) fills the page background — the same feed
the homepage uses — making the About page feel like part of the instrument rather than a
static informational document. The project description sits inside a dark
viewport panel that preserves legibility over the moving video.

The copy opens with a short introduction, followed by "HOW IT STARTED",
"HOW IT WORKS", and "MORE DETAILS" sections. It never attributes the live
cameras to a provider or city, because they come from more than one
provider. It may name the project's tools (Roboflow, Google Cloud Run) and
the hackathon it came from.

```gherkin
Given I open the XWALK KEYBOARDS About page
When the page loads
Then the header reads "XWALK KEYBOARDS | ABOUT"
And the ABOUT label is rendered as plain text, not underlined, because I am already on the About page
And a feed status reads "CONNECTING // WEST STREET @ W23 ST" with an inactive status dot
And a dark viewport panel is visible below the feed status
And the viewport opens with a paragraph explaining that XWalk Keyboards uses traffic camera video feeds to transform crosswalks into piano keyboards
And the paragraph mentions that pedestrians step on white stripes and the app plays the corresponding notes
And "HOW IT STARTED", "HOW IT WORKS", and "MORE DETAILS" sections follow
And "HOW IT WORKS" says the web app uses Roboflow to detect pedestrians in a traffic cam video in real time
And no copy attributes the live cameras to a provider or city (no "511NY" or "Bellevue"; the NYC hackathon history in "HOW IT STARTED" is not a camera attribution)
And body copy is set in 12px monospace
And no study links or eyebrow labels are shown
And the footer reads "ABOUT // POWERED BY: Roboflow + Google Cloud Run" with ABOUT as plain text, not a self-link
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage

When the camera feed becomes active
Then the feed status reads "FEED LIVE // WEST STREET @ W23 ST" with a live mint dot
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
Then the footer reads "ABOUT // POWERED BY: Roboflow + Google Cloud Run"
And "ABOUT" is plain text, not a link
```

## Camera Registry

### As a developer, I can review every registered camera and its feed status

The camera registry is a developer tool, not a visitor-facing study: it is
not linked from navigation. It shows every registered live camera at a glance,
playing its live feed, so a developer can see which cameras are up and which
are down without opening each Realtime page. The list comes from the camera
registry, so adding or removing a camera changes the page with no other edit.
Unlisted cameras are included, because the page is about what is registered,
not what visitors are offered.

```gherkin
Given I open the XWALK KEYBOARDS camera-registry page
When the page loads
Then the page header reads "XWALK KEYBOARDS | CAMERA REGISTRY"
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage
And I see one card for every registered live camera, listed or unlisted, in registry order
And the cards are numbered in that order starting at 01
And there are no section headings and no separate live-feed column
And each card shows that camera's live video, muted
And each card is labeled "CAMERA_<index> // VIEW_<camera ID>"
And each card shows "STREET LOCATION: <location>" beneath the label
And the page does not invoke Roboflow inference, stripe highlights, or audio
And the footer reads "ABOUT // POWERED BY: Roboflow + Google Cloud Run"

Given a registered camera's feed is down
When the page loads
Then that camera's card stays in its registry position
And its video area shows that the feed is unavailable rather than disappearing from the grid

Given a camera has a public provider page
Then its card shows a mint external-link icon to the right of its label
And selecting it opens the provider's page in a new tab
And a 511NY camera's icon opens "https://511ny.org/map/Cctv/<camera ID>"
And a Bellevue camera's icon opens the City of Bellevue traffic map
And no upstream video URL is exposed to the browser

Given a camera has no public provider page, such as the private CARLA camera
Then its card shows no external-link icon
```

On a phone the cards stack in a single column, and the label shortens.

```gherkin
Given I open the camera-registry page on a mobile viewport
Then the cards stack in a single column in the same order
And each card is labeled "CAM <index> // <camera ID>"
And each card shows "<location>" beneath the label without the "STREET LOCATION:" prefix
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

### As an operator, I can record the Realtime study with its sound

Demo videos of the study are only honest with the piano in them, and the
macOS screen recorder captures the microphone, not the sound a browser tab
plays. The debug panel records the tab itself, so one take holds the live
video, the stripe glow, and the notes, in sync. The file is saved on the
operator's machine; nothing is uploaded. Tab recording with audio is a
Chromium capability, so other browsers show the control disabled.

Recording carries on with the debug panel closed, which keeps the panel out of
the video. The browser's own sharing controls stop it as well as the panel.

Takes are saved as WebM (VP9 video, Opus audio) even where the browser offers
MP4. Chrome's MP4 recordings of a shared tab can drop the bottom rows of every
frame after the first, which leaves QuickTime showing a single frozen frame over
live audio. Convert a take to MP4 afterwards:

```bash
ffmpeg -i xwalk-<cameraId>-<date>-<time>.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac xwalk.mp4
```

```gherkin
Given the debug panel is open in a Chromium browser
Then a RECORD TAB button is shown
When I select RECORD TAB
Then the browser asks to share a tab and offers the current tab first
And the button reads "WAITING FOR SHARE..." until I answer

When I share the current tab with its audio
Then recording starts
And the button reads "STOP RECORDING" followed by the elapsed time
And recording continues when I close the debug panel
When I select STOP RECORDING, or stop sharing from the browser's own controls
Then the recording ends
And it downloads as "xwalk-<cameraId>-<date>-<time>.webm"
And the file contains the tab's video, the stripe overlay, and the piano notes
And the button returns to RECORD TAB

Given I share the tab without its audio
Then no recording starts
And the panel explains that the tab must be shared again with its audio on

Given I dismiss the share prompt
Then no recording starts
And the button returns to RECORD TAB with no error

Given a recording is in progress
When I leave the Realtime study
Then the recording stops and the tab is no longer shared
And the partial recording is discarded rather than downloaded

Given the browser cannot record a tab
Then the button reads "RECORD TAB (CHROME ONLY)" and is disabled
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

### As a developer, I can confirm the app stores nothing on the visitor's device

Analytics on this site is cookieless by construction, not by configuration.
Nothing is written to the device, so there is no consent banner and no
visitor identity to leak. This is the invariant every other analytics
scenario depends on — if it breaks, the banner-free posture breaks with
it. It is worth asserting in a test rather than trusting by inspection.

```gherkin
Given I load any page of the site with a clean browser profile
When the page has finished loading and the analytics beacons have fired
Then document.cookie is empty
And localStorage and sessionStorage contain no entries
And no visitor ID, session ID, or device fingerprint is generated anywhere in the client
And no consent banner or cookie notice is rendered

Given I navigate between pages via client-side routing
Then no identifier is created to link the two page views
And the two page views cannot be attributed to the same visitor
```

### As a developer, page views are counted by a cookieless third-party beacon

The generic traffic layer — pageviews, referrers, geography, Core Web
Vitals — comes from Cloudflare Web Analytics rather than from code we
maintain. The site is not proxied through Cloudflare, so the hostname is
registered manually and the beacon posts cross-origin to Cloudflare.

The site token is public by design; it ships in the HTML of every page and
is not a secret. It is therefore inlined in the layout rather than injected
through the environment, which keeps the project's server-only env var rule
intact and leaves the Dockerfile untouched.

```gherkin
Given I load any page of the site
Then a beacon script is loaded from static.cloudflareinsights.com
And it carries the public site token as a data attribute
And it is deferred so it never blocks first paint
And measurement data is sent to cloudflareinsights.com/cdn-cgi/rum

Given the beacon script is blocked by an ad blocker or fails to load
Then no console error surfaces to the visitor
And every page renders and behaves normally

Given I navigate between routes without a full page load
Then the beacon reports the new route as a page view
```

Beyond this, the only telemetry the app emits is GPU startup timing, which
predates analytics and is documented above. There is deliberately no
first-party page view endpoint: app-specific events (which camera was
chosen, whether the keyboard produced sound) are out of scope until there
is a question we actually want answered.
