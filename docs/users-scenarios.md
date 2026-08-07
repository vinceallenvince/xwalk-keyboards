# Homepage User Scenarios

## Feature: Discover and choose an XWALK KEYBOARDS study

The homepage introduces XWALK KEYBOARDS over a fixed, darkened West Street
traffic-camera feed, then invites the visitor to choose a study mode.

## Homepage

### As a visitor, I arrive at an immersive XWALK KEYBOARDS homepage

The homepage uses the live West Street camera as a darkened, full-viewport
canvas. The title and the quiet technical metadata establish the study before
asking the visitor to scroll.

```gherkin
Given a visitor opens the XWALK KEYBOARDS homepage
When the homepage finishes loading
Then a live West Street at W23 Street video feed fills the viewport background
And the video feed remains darkened so foreground content is legible
And the upper-left status indicator reads "FEED LIVE // WEST STREET @ W23 ST"
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
And the selector presents "REALTIME" and "ORCHESTRATION" as the available study modes
And a mint vertical divider separates the two study modes
And "REALTIME" and "ORCHESTRATION" are rendered in their inactive gray states
```

### As a visitor, I can preview a study mode before choosing it

Both study modes are inactive gray by default. Hovering a mode gives it the
mint highlight and returns the other mode to gray, making the prospective
selection clear before the visitor commits.

```gherkin
Given the study selector is centered in the viewport
When the visitor rolls over "ORCHESTRATION"
Then "ORCHESTRATION" changes to the active highlight color
And "REALTIME" changes to its inactive gray state
When the visitor rolls over "REALTIME"
Then "REALTIME" changes to the active highlight color
And "ORCHESTRATION" changes to its inactive gray state
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

### As a visitor, I can open the Camera Registry from the footer

The footer provides a persistent link to the internal Camera Registry from the
homepage and every study subpage.

```gherkin
Given I am viewing the XWALK KEYBOARDS homepage or a study subpage
Then the footer includes a "CAMERA REGISTRY" link
When I select the "CAMERA REGISTRY" link
Then I am taken to the Camera Registry page
And I can review the priority and fallback camera sets
```

### As a visitor, I leave a study without its media or audio continuing off-page

Leaving a study ends work that belongs only to that route. A new page must not
inherit live connections, background polling, scheduled audio, or fading notes
from the study that the visitor has left.

```gherkin
Given I am viewing a Realtime or Orchestration study
When I navigate to the homepage, Camera Registry, or another study
Then the prior study's audio is stopped, including any fading notes
And its scheduled audio events are cleared
And its background polling and inference work are stopped
And its live video or WebRTC connections are released when they are no longer needed
And the destination page starts only the connections and work required for its own experience
```

## Realtime Study

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
And the feed status reads "CONNECTING // WEST STREET @ W23 ST"
And the inference status reads "STARTING ROBOFLOW GPU ..."
And a large dark camera viewport is reserved in the center of the page
And the "FULLSCREEN" and "SOUND ON" controls are visible but visually inactive
And the source footer reads "NYC DOT CCTV FEED SOURCE // CAMERA ID: 402"
And no spinner or unrelated loading indicator is shown
```

### As a visitor, I can see a live camera while inference is still starting

The camera commonly becomes ready before the GPU. In that case, the live video
should appear immediately; it must not be held behind the inference startup.

```gherkin
Given I am on the Realtime study page
And the West Street camera feed becomes active before Roboflow inference
When the live camera frame is available
Then the feed status reads "FEED LIVE // WEST STREET @ W23 ST"
And the live camera video fills the reserved central viewport
And the inference status continues to read "STARTING ROBOFLOW GPU ..."
And sound and detection-dependent feedback remain unavailable until inference is active
```

### As a visitor, I can see that inference is ready while the camera is still connecting

Roboflow can also finish first. The inference status should become active
without falsely presenting a camera image that has not yet arrived.

```gherkin
Given I am on the Realtime study page
And Roboflow inference becomes active before the West Street camera feed
When the Roboflow GPU has started
Then the inference status reads "STATUS: ROBOFLOW ACTIVE"
And the feed status continues to read "CONNECTING // WEST STREET @ W23 ST"
And the large camera viewport remains in its waiting state until a live camera frame is available
```

### As a visitor, I can experience the fully active Realtime study

Once the independently-started camera and inference cycles are both active, the
study enables its complete live experience. The page retains its black ground
and quiet technical metadata so the moving image remains the focus.

```gherkin
Given I am on the Realtime study page
And the West Street camera feed is active
And Roboflow inference is active
When both active states are available at the same time
Then the page header reads "XWALK KEYBOARDS | REALTIME"
And the feed status reads "FEED LIVE // WEST STREET @ W23 ST"
And the inference status reads "STATUS: ROBOFLOW ACTIVE"
And the live camera video fills the reserved central viewport
And the "FULLSCREEN" control is available at the lower-right of the viewport
And the sound control is available beside it and indicates its current sound state
And the source footer reads "NYC DOT CCTV FEED SOURCE // CAMERA ID: 402"
```

### As a visitor, I can see and hear pedestrians play the Realtime crosswalk

When Realtime inference is active, the live image distinguishes pedestrians by
whether they are in the calibrated crosswalk. Only people inside the crosswalk
become part of the instrument. The visual response belongs to the painted
crosswalk stripe, not to a floating marker above the pedestrian.

```gherkin
Given I am viewing an active Realtime study
And the West Street camera feed and Roboflow inference are active
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
And the inference status no longer presents Roboflow as active
And no new crosswalk notes or stripe highlights are produced while inference is unavailable
And no stale stripe highlight remains over the moving video
And the camera connection is not restarted solely because inference was lost
When the inference connection recovers
Then the inference status becomes active again
And crosswalk highlights and qualifying notes resume from new detections
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
And the active camera renders its next queued image
And the active camera image shows a purple triangle above each detected pedestrian outside its crosswalk
And the active camera image shows a green triangle above each detected pedestrian inside its crosswalk
And no crosswalk stripe highlight is rendered in the Orchestration grid
And the active camera remains active for five seconds
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
Then the active interval is silent
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
its matching score. The next batch is prepared in the background; it cannot
replace the visible batch until its images and score are both ready and valid.

```gherkin
Given a complete twelve-camera batch is playing in the Orchestration study
When newer camera images become available
Then the app prepares the next twelve-camera batch in the background
And the currently displayed images and their score remain paired for the entire 60-second loop
And a delayed or invalid score is never applied to a newer set of camera images
When the next batch has twelve frozen camera images and a valid matching score
Then it becomes eligible to replace the current batch at the next loop boundary
When the next batch's score is unavailable, invalid, or late at the loop boundary
Then the app replays the prior valid batch and its matching score
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
