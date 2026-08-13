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
Given I am viewing a Realtime, Orchestration, or Sequence study
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
`KEYBOARD UNAVAILABLE`, `KEYBOARD PAUSED`.

A visitor does not need to know that the second line describes a remote GPU
running pedestrian detection, and naming the vendor tells them nothing they can
act on. Naming the instrument tells them exactly what they are waiting for. The
scenarios below quote the instrument vocabulary; the underlying inference state
machine in [`architecture.md`](architecture.md) is unchanged.

The one exception is a camera outage. When the feed itself is down the
instrument line defers to the real cause and reads `FEED UNAVAILABLE` rather
than blaming the keyboard for a failure upstream of it.

### As a visitor, I can see that the Realtime study is connecting

The Realtime study has its own sparse, black-ground interface. The camera
connection and Roboflow GPU startup are independent asynchronous cycles, each
with its own visible status. Neither is required to finish first, and the
interface does not imply that one is waiting on the other.

```gherkin
Given I have chosen the "REALTIME" study from XWALK KEYBOARDS
When the Realtime study opens
Then the page header reads "XWALK KEYBOARDS | REALTIME"
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage
And the feed status reads "CONNECTING // WEST STREET @ W34 ST"
And the inference status reads "STATUS: KEYBOARD WARMING UP..."
And a large dark camera viewport is reserved in the center of the page
And the "FULLSCREEN" and "SOUND ON" controls are visible but visually inactive
And the source footer reads "NYC DOT CCTV FEED SOURCE // CAMERA ID: 910"
And no spinner or unrelated loading indicator is shown
```

### As a visitor, I can see a live camera while inference is still starting

The camera commonly becomes ready before the GPU. In that case, the live video
should appear immediately; it must not be held behind the inference startup.

```gherkin
Given I am on the Realtime study page
And the West Street at W. 34 St camera feed becomes active before Roboflow inference
When the live camera frame is available
Then the feed status reads "FEED LIVE // WEST STREET @ W34 ST"
And the live camera video fills the reserved central viewport
And the inference status continues to read "STATUS: KEYBOARD WARMING UP..."
And sound and detection-dependent feedback remain unavailable until inference is active
```

### As a visitor, I can see that inference is ready while the camera is still connecting

Roboflow can also finish first. The inference status should become active
without falsely presenting a camera image that has not yet arrived.

```gherkin
Given I am on the Realtime study page
And Roboflow inference becomes active before the West Street at W. 34 St camera feed
When the Roboflow GPU has started
Then the inference status reads "STATUS: KEYBOARD READY!"
And the feed status continues to read "CONNECTING // WEST STREET @ W34 ST"
And the large camera viewport remains in its waiting state until a live camera frame is available
```

### As a first-time visitor, I am told how to play the crosswalk

The Realtime study is silent and still until a pedestrian steps onto the
crosswalk, and it takes several seconds to begin watching. A short modal on first visit sets the two expectations that make the wait legible, *the stripes are the keys*, and *nothing happens until someone crosses*. Because it appears immediately, while the camera and inference are still starting, reading it costs no extra time.

The copy stays deliberately sparse. It names no vendor, no GPU, and no
inference. A visitor needs to know that the instrument is warming up, not what
is warming up. The startup wait is framed as the keyboard warming up, matching
the inference status line behind the scrim.

The modal does not control sound. Dismissing it is purely informational. It
counts as a user gesture for the browser's audio-activation requirement, but the
app already enables sound automatically when the keyboard becomes ready, so the
modal does not need to do that work. A single "CLOSE" button keeps the footer
clean.

```gherkin
Given I am a first-time visitor with no record of having seen the instructions
When the Realtime study opens
Then a centered modal appears over the camera viewport
And the viewport behind it is dimmed by a scrim and cannot be interacted with
And the modal title reads "HOW TO HEAR XWALK KEYBOARDS"
And the modal explains that each white stripe is a key played by pedestrians crossing
And the modal explains that the keyboard takes a few seconds to warm up
And the modal explains that nothing plays until someone steps onto the stripes
And the modal names no vendor, GPU, model, or inference technology
And the modal offers a single "CLOSE" control
And the camera connection and keyboard startup continue behind the modal
And the feed and keyboard statuses remain visible and truthful behind the scrim

When I select "CLOSE"
Then the modal closes
And the app records that the instructions have been seen
And I return to the Realtime study in whatever state it has reached while I read

When I press Escape or select the scrim outside the modal
Then the modal closes in the same way as "CLOSE"
```

### As a returning visitor, I can reopen the instructions from the header

Once seen, the instructions never reappear on their own. They stay reachable
from a small info icon beside the study header, so a visitor who arrives at an
empty crosswalk later can confirm that silence is the instrument waiting rather
than the study failing.

```gherkin
Given I have previously seen and dismissed the Realtime instructions
When the Realtime study opens
Then no instructional modal is shown
And the study begins its normal camera and inference startup
And a small info icon sits to the right of the "XWALK KEYBOARDS | REALTIME" header
And the info icon is present on first visit as well, once the modal is dismissed

When I select the info icon
Then the same instructional modal reopens over the current viewport
And the live video, feed status, and inference status continue behind it
And dismissing it returns me to the study unchanged
And reopening the instructions does not restart the camera, inference, or the five-minute inference window
```

The instructional modal and the five-minute pause modal are never shown at the
same time. The pause modal owns the viewport when it appears, and the info icon
does not summon the instructions over it.

```gherkin
Given the five-minute inference pause modal is shown
Then the instructional modal is not shown over it
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

```gherkin
Given I am viewing an active Realtime study
And the West Street at W. 34 St camera feed and Roboflow inference are active
When a pedestrian is detected inside the calibrated crosswalk
Then the app maps the pedestrian's position to the corresponding crosswalk stripe
And the left-most white stripe maps to the piano note "C"
And each stripe to the right maps to the next piano key
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
And the modal title reads "KEYBOARD PAUSED"
And the modal explains that the keyboard has been paused to conserve resources
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
And the inference status reads "KEYBOARD PAUSED: RELOAD TO CONTINUE"
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

## Orchestration Study

### As a visitor, I can see the complete orchestration grid while it prepares to perform

The Orchestration study begins as a 3 × 4 collection of the curated static
intersection cameras. It shows the first available full-color image for each
camera before performance begins, while independently preparing each camera's
next image in the background.

```gherkin
Given I have chosen the "ORCHESTRATION" study from XWALK KEYBOARDS
When the Orchestration study opens
Then I see a 3 × 4 grid of 12 different static camera images
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage
And every image is initially rendered in full color
And every camera view includes a visible crosswalk
And each camera has its own image queue held in memory
And a visible, non-blocking loading indicator communicates that the performance is preparing its camera queues
And the app begins checking each camera's image feed for a newer image
And the app continues checking for newer images for as long as I remain on the Orchestration study page
And when a newer image is available for a camera, the app appends it to that camera's queue
And the app does not begin the performance cycle until every camera queue contains at least one queued image
And the loading indicator remains visible during the initial queue-building period, which may take up to the first minute
When every camera queue contains at least one queued image
Then the loading indicator clears
And the Orchestration performance cycle begins
```

### As a visitor, I can experience an uninterrupted performance when a priority camera is unavailable

The performance treats a maintenance or no-live-feed image as an unavailable
source, rather than as a valid camera frame. An available fallback camera takes
over the affected priority camera's existing position without disrupting the
twelve-camera composition.

```gherkin
Given a priority camera is assigned to a position in the Orchestration grid
When its image feed returns a maintenance or no-live-camera state
Then the app identifies that source as unavailable
And the app selects the next available configured fallback camera
And the fallback camera replaces the unavailable priority camera in the same grid position
And the fallback camera retains that position's five-second turn in the performance cycle
And the remaining camera positions, queues, and performance timing remain uninterrupted
And the app continues polling the unavailable priority camera for recovery
When the priority camera returns a valid newer image
Then the app queues that image
And the priority camera resumes its original grid position in a later performance cycle
```

### As a visitor, I can experience one camera as the active performer

Once every camera has a queued image, the study transforms the grid into a
score. The currently active camera is the sole full-color image; the remaining
eleven cameras remain visible in black and white as the surrounding ensemble.

```gherkin
Given every camera queue contains at least one queued image
When the Orchestration performance cycle begins
Then every camera image in the 3 × 4 grid changes to black and white
And Camera 01 becomes the active camera
And Camera 01 is displayed in full color
And every non-active camera remains displayed in black and white
And each non-active camera is the black-and-white presentation of its matching frozen batch image
And the active camera renders its next queued image
And the active camera image shows a purple triangle above each detected pedestrian outside its crosswalk
And the active camera image shows a green triangle above each detected pedestrian inside its crosswalk
And no crosswalk stripe highlight is rendered in the Orchestration grid
And the active camera remains active for five seconds
```

### As a visitor, I can experience conductor-selected visual emphasis

The conductor may emphasize a distinctive active interval without changing
which frozen image or five-second score event is being presented. It selects a
bounded presentation mode; the browser owns the visual transition mechanics.

```gherkin
Given a complete Orchestration batch and its validated conductor score are active
And the active score event has visual presentation "grid"
When that five-second event begins
Then its camera remains in its assigned location in the 3 × 4 grid
And that active tile is displayed in full color while every non-active tile remains black and white
And no edge-to-edge hero layer is shown

Given a complete Orchestration batch and its validated conductor score are active
And the active score event has visual presentation "hero"
When that five-second event begins
Then the event's exact frozen active-camera image is rendered edge to edge in a layer above the grid
And the 3 × 4 grid remains hidden behind the hero layer
And the corresponding event audio and visual presentation begin in the same five-second interval
And the browser uses its fixed visual transition rather than agent-generated animation instructions
When the next five-second event begins
Then the browser removes or replaces the hero layer according to that next event's validated visual presentation
```

### As a visitor, I can hear pedestrians turn an active crosswalk into a keyboard

Only pedestrians inside the active camera's crosswalk create music. Each
crosswalk's white stripes behave as successive piano keys, rooted at C on the
left-most stripe.

```gherkin
Given a camera is active in the Orchestration performance cycle
When a detected pedestrian is inside that camera's crosswalk
Then the app maps the pedestrian to the crosswalk stripe containing their position
And the left-most white stripe is mapped to the piano note "C"
And each stripe to the right maps to the next piano key
And the app plays the note mapped to each occupied stripe
And multiple pedestrians inside the crosswalk can trigger their corresponding notes together
When a detected pedestrian is outside the active camera's crosswalk
Then the pedestrian is shown with a purple triangle
And the pedestrian does not trigger a note
When no pedestrians are inside the active camera's crosswalk
Then the active interval plays no pedestrian note
```

### As a visitor, I can hear the Orchestration study as one continuous composition

The Orchestration study supplies a restrained rhythmic pulse even when a
camera’s crosswalk is empty. The pulse gives every five-second camera interval
a clear place in the same 60-second composition without delaying or inventing
pedestrian notes.

```gherkin
Given the Orchestration performance cycle is active
And the sound control reads "SOUND ON"
When the 60-second performance begins
Then a fixed 96 BPM, 4/4 Tone.js transport begins with the performance
And the background beat continues across the full 60-second loop
And each active camera occupies exactly two bars, or five seconds
When an active camera has occupied crosswalk stripes
Then its pedestrian notes begin on the current two-bar beat grid
And its note gesture remains synchronized with the background beat
When an active camera has no occupied crosswalk stripes
Then no pedestrian note is played for that camera
And the background beat continues without interruption
When Camera 12 completes its active interval
Then Camera 01 begins on the next loop boundary in time with the continuing transport
```

### As a visitor, I can follow the repeating twelve-camera performance

The active state progresses through the grid in reading order and repeats
continuously. Background polling and queueing continue throughout, so later
cycles can use newly available camera images.

```gherkin
Given Camera 01 is active in the Orchestration performance cycle
When its five-second active interval ends
Then Camera 02 becomes the active full-color camera
And Camera 01 returns to black and white
And any notes for Camera 01 continue to fade out as Camera 02's notes are evaluated
And Camera 02 plays notes only for pedestrians inside Camera 02's crosswalk during its five-second active interval
And notes that began during any camera's active interval are not abruptly stopped when the next camera becomes active
And those notes are allowed to fade out naturally while the next camera's notes are evaluated
And the active state continues in grid reading order through Camera 12
When Camera 12's five-second active interval ends
Then Camera 01 becomes active again
And the twelve-camera performance loop continues while I remain on the page
And the app continues polling every camera feed and adding newly available images to its corresponding queue during the loop
```

### As a visitor, I experience only complete, synchronized Orchestration batches

Each 60-second performance uses one immutable set of twelve camera images and
its matching score and visual sequence. The next batch is prepared in the
background; it cannot replace the visible batch until its images and score are
both ready and valid.

```gherkin
Given a complete twelve-camera batch is playing in the Orchestration study
When newer camera images become available
Then the app prepares the next twelve-camera batch in the background
And the currently displayed images, their score, and their visual presentation directions remain paired for the entire 60-second loop
And a delayed or invalid score or visual sequence is never applied to a newer set of camera images
When the next batch has twelve frozen camera images and a valid matching score
Then it becomes eligible to replace the current batch at the next loop boundary
When the next batch's score is unavailable, invalid, or late at the loop boundary
Then the app replays the prior valid batch and its matching score and visual sequence
And the app does not display an unscored or mismatched new batch
```

### As a visitor, I can turn the Orchestration sound on or off

The Orchestration study exposes a sound-state control without stopping the
visual performance. "SOUND ON" means its Tone.js score is enabled and
qualifying note events are audible; "SOUND OFF" means the visual performance
continues silently.

```gherkin
Given the Orchestration performance cycle is active
Then a sound control is visible and indicates the current state as "SOUND ON" or "SOUND OFF"
When the control reads "SOUND ON"
Then qualifying pedestrian notes are audible
And the visual camera cycle continues uninterrupted
When I activate the "SOUND ON" control
Then the control changes to "SOUND OFF"
And no new pedestrian notes are played
And any currently sounding or fading notes are silenced
When I activate the "SOUND OFF" control
Then the control changes to "SOUND ON"
And later qualifying pedestrians can trigger their corresponding piano notes
```

### As a visitor, I can view the Orchestration performance full screen

Fullscreen makes the twelve-camera performance the entire experience while
preserving the grid's 3 × 4 arrangement and its active-camera treatment.

```gherkin
Given the Orchestration performance cycle is active
And I am viewing the 3 × 4 camera grid
When I activate the "FULLSCREEN" control
Then the camera grid expands to fill the viewport edge to edge
And the grid retains its 3 × 4 arrangement
And the active camera remains full color while non-active cameras remain black and white
And the surrounding study interface and controls are hidden
And an exit hint reads "CLICK ANYWHERE OR PRESS ESC TO EXIT"
When I click anywhere in the fullscreen view or press Escape
Then fullscreen mode closes
And I return to the Orchestration study with its controls restored
```




## Sequence Study

The Sequence study turns a rolling buffer of static traffic-camera images into
a three-row, four-column piano roll. Its initial buffer contains twelve images:
the current four-image row, the next four-image row, and an on-deck row. A row
represents a twenty-second phrase made of four five-second image intervals.

### As a visitor, I can see Sequence prepare its first playable phrase

Sequence receives its initial image buffer before rendering camera imagery in
the grid. It gives the first, currently-playing row priority in the Roboflow
queue, so the study can begin as soon as all four of its intervals are safely
playable.

```gherkin
Given I have chosen the "SEQUENCE" study from XWALK KEYBOARDS
When the Sequence study opens
Then the page header reads "XWALK KEYBOARDS | SEQUENCE"
And the upper-left "XWALK KEYBOARDS" wordmark is available as a link back to the homepage
And the page reserves a three-row, four-column sequencer grid without rendering the received camera images into it yet
And the grid shows its loading treatment and a visible count of received images out of 12
And the page reports that Roboflow detection is active or preparing
And the app requests 12 configured traffic-camera images into an in-memory sequence buffer
And the first four buffered images are placed ahead of later images in the Roboflow detection queue
And no playback head, phrase beat, or pedestrian note begins during this loading state

Given the Sequence study is receiving its initial image buffer
When all 12 image requests have completed
Then every buffer position contains either its fetched camera image or its fallback image
And the app continues sending queued images to Roboflow in row-first order
And the loading state remains visible until the first four sequence positions each have a terminal playback result
```

### As a visitor, I can begin playback as soon as the first row is safe to play

A first-row position is safe to play when Roboflow has returned an annotated
image and the Sequence score agent has returned a valid matching phrase score,
or when a failed detection, fetch, or score has produced its explicitly silent
fallback result. The study does not hold the first phrase forever waiting for a
perfect response.

```gherkin
Given the Sequence study has received its initial 12-image buffer
And the first four sequence positions are being processed ahead of the remaining positions
When all four first-row positions have a terminal playback result
Then the loading treatment clears
And the study renders the three-row, four-column sequencer viewport
And row 1 contains the first four sequence positions in full color at full opacity
And row 2 contains the next four sequence positions in black and white at reduced opacity
And row 3 contains the following four positions in black and white at the lowest opacity
And the playback head begins at the zero-second mark of row 1
And the visual phrase duration is 20 seconds
And a repeating 20-second beat transport begins with the phrase
And the beat is audible only when the visitor has enabled sound through a browser-permitted sound interaction
```

### As a visitor, I can see pedestrians play the crosswalk piano roll

Each green in-crosswalk arrow is both a visual event and a note event. The
crosswalk stripes are a chromatic keyboard: the left-most mapped stripe is C,
and each stripe to its right advances one semitone. The Sequence score agent
identifies the stripe occupied by each immutable green-arrow detection; the
browser derives pitches and controls timing.

```gherkin
Given the Sequence playback head is moving across a full-color row-1 image
And that image has a successful Roboflow annotation
And the Sequence score agent has returned a valid score for that image's four-image phrase
When the playback head intersects a green arrow for a pedestrian inside the calibrated crosswalk
Then the score identifies that green arrow's immutable detection ID and occupied crosswalk stripe
And the left-most mapped stripe plays the chromatic root note "C"
And each stripe to the right maps to the next chromatic piano note
And the app triggers the note mapped to that stripe when sound is enabled
And the intersected green arrow receives a brief pop or equivalent motion treatment synchronized with the note
And multiple intersected green arrows can trigger their corresponding notes together

Given the playback head intersects a pedestrian marker outside the calibrated crosswalk
Then that marker does not trigger a piano note

Given the playback head intersects a silent fallback or unannotated image
Then no pedestrian note or arrow-pop event is triggered for that image
```

### As a developer, I can inspect a concise phrase description without exposing it in the study UI

The Sequence score agent returns a short diagnostic description of the current
row-1 phrase. It supports debugging and does not act as participant-facing
copy, visual direction, or audio instruction.

```gherkin
Given the Sequence score agent returns a valid score for a four-image row-1 phrase
Then the score includes one plain-text row-1 description no longer than 250 characters
And the description is retained with its matching immutable phrase ID for developer diagnostics
And the description is never rendered in the Sequence grid, status bar, footer, fullscreen view, or accessible participant-facing text
And the description does not alter note selection, beat placement, image phase offsets, or visual transitions
```

### As a visitor, I can feel the first pedestrian event land on the beat

The first playable green arrow in each image establishes only that image's
visual phase. The score agent never controls tempo, beat placement, image
translation, or animation. The browser uses the arrow's returned geometry to
make a bounded visual correction so the playback head crosses it on the nearest
musical beat.

```gherkin
Given a Sequence image has a valid phrase score and one or more scored green arrows
When the browser prepares that image for playback
Then the browser selects the left-most scored green arrow as the image's first playback event
And the browser calculates that arrow's unadjusted crossing time from its horizontal anchor coordinate and the five-second image interval
And the browser quantizes that crossing time to the nearest downbeat of the fixed 96 BPM transport
And the browser calculates and applies a bounded per-image visual phase offset so the playback head and selected green arrow are vertically aligned on that beat
And the same offset is used for the arrow-pop treatment and its scheduled piano note
And the offset never changes the phrase tempo, playback-head speed, or another image's timing

Given a Sequence image has no scored green arrow
When the browser prepares that image for playback
Then the image uses a zero visual phase offset
And the image produces no pedestrian note or arrow-pop event
```

### As a visitor, I can follow the rolling image queue while a phrase plays

The current phrase must remain visually stable while later rows improve in the
background. Roboflow results may replace their matching upcoming image before
that image is promoted, but they may never be applied to another sequence
position.

```gherkin
Given a 20-second Sequence phrase is playing
When Roboflow returns an annotation for an image assigned to row 2 or row 3
Then the app replaces only that matching upcoming image with its annotated version
And the updated upcoming image remains black and white and dimmed until it reaches row 1
And row 1's four images remain unchanged for the duration of the current phrase
And the app prepares an immutable four-image phrase score only after every image in that upcoming phrase has a terminal Roboflow result
And the app continues queueing later buffered images and replacement images while playback continues
And no annotation, green arrow, phrase score, or note mapping is associated with a different image or sequence position
```

### As a visitor, I can experience an uninterrupted rolling sequence

At the twenty-second boundary, Sequence advances by a complete row rather than
replacing individual images mid-phrase. The lower row is populated atomically
only once four next images are ready, preserving the instrument's timing.

```gherkin
Given the Sequence playback head reaches the 20-second end of row 1
And row 2 contains the next complete four-image phrase
When the phrase loops to the zero-second mark
Then the prior row 1 disappears
And the prior row 2 animates into row 1
And the prior row 3 animates into row 2
And the playback head restarts at the zero-second mark of the promoted row 1
And the 20-second beat transport continues on the phrase boundary
And the app begins or continues preparing the next four-image row for row 3

Given at least four consecutive next sequence positions are ready for display
When row 3 becomes available after a phrase boundary
Then the app populates row 3 with those four images as one row
And the new row 3 remains black and white at the lowest opacity until promotion

Given fewer than four next sequence positions are ready at a phrase boundary
Then the app does not partially populate row 3
And the row 3 loading treatment remains visible
And the current full row-1 phrase continues to loop until a complete next phrase is ready
```

### As a visitor, I can continue through unavailable images without false musical events

Sequence distinguishes a successful annotation from an image that is merely
safe to show. Detection and fetch failures retain their sequence positions so
timing and row shifts stay intact, but they remain silent when promoted.

```gherkin
Given an image in the Sequence detection queue cannot be processed by Roboflow
When the detection request reaches its terminal failure state
Then the app retains the source image in that exact sequence position without annotation
And that position counts as ready for row and phrase progression
And its playback-head intersection triggers no piano note or arrow motion
And processing continues for later queued images

Given an image request fails before a source image is available
When the fetch reaches its terminal failure state
Then the app uses the configured fallback image in that exact sequence position
And that fallback image counts as ready for row and phrase progression
And its playback-head intersection triggers no piano note or arrow motion
And the app continues to fill and process the remaining sequence positions
```

### As a visitor, I can control Sequence sound without stopping its timeline

The visual sequencer keeps time even when sound is unavailable or disabled.
The sound control follows browser audio-permission requirements and affects the
beat and qualifying crosswalk notes together.

```gherkin
Given the Sequence study is loading or playing
Then a sound control is visible and indicates its current sound state
When sound is disabled
Then the playback head and row-shift animations continue silently
And no phrase beat or pedestrian piano note is audible
When I enable sound through the sound control
Then the current or next phrase beat becomes audible without restarting the visual timeline
And later qualifying green-arrow intersections can trigger their mapped piano notes
When I disable sound through the sound control
Then the phrase beat and any currently sounding pedestrian notes are silenced
And the visual timeline continues without interruption
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

Given I am viewing a study subpage (Realtime, Orchestration, or Sequence)
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
