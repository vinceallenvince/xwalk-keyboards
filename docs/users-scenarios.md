# Homepage User Scenarios

## Feature: Watch XWALK KEYBOARDS play a crosswalk

The homepage introduces XWALK KEYBOARDS over a fixed, darkened live
traffic-camera feed, then invites the visitor to watch an introduction video:
screen recordings of pedestrians crossing West Street and playing notes on the
crosswalk.

The live study (Realtime: in-browser person detection, live crosswalk
calibration, and synthesized notes) has been retired. The live camera feeds
remain as ambient backgrounds and in the Camera Registry, but no page runs
inference or plays notes.

### Camera placeholders

Live cameras come from more than one public provider (511NY in New York,
the City of Bellevue in Washington, and a private CARLA simulation), so
scenarios that apply to every camera use a placeholder rather than one
intersection's copy:

- `<CAMERA STATUS LABEL>` — the camera's short status-bar name, for example
  `WEST STREET @ W23 ST` (CAM 5059, New York) or
  `BELLEVUE WAY @ NE 8TH ST` (CAM 80007, Bellevue, WA).

Visitor-facing copy does not credit a camera provider, with one exception:
the homepage introduction says the project used NYC DOT traffic cam video.
The status line names the intersection; the footer credits only the tools
that power the site.

The homepage and About backgrounds use 511NY's West Street at W. 23 St camera
(CAM 5059).

## Homepage

### As a visitor, I arrive at an immersive XWALK KEYBOARDS homepage

The homepage uses the live West Street at W. 23 St camera (CAM 5059) as a
darkened, full-viewport canvas. The title and the quiet technical metadata
establish the project before asking the visitor to scroll.

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
```

### As a visitor, I can scroll from the title into the introduction video

The title leaves the frame as the visitor scrolls, while the traffic feed
remains fixed behind the interface. A dark editorial band rises into the
center of the viewport: a short introduction on one side and an embedded
YouTube video on the other.

```gherkin
Given the visitor is viewing the homepage hero
When the visitor scrolls down past the initial hero position, or selects "SCROLL"
Then the "XWALK KEYBOARDS" title scrolls upward and exits the top of the viewport
And the live traffic-camera background remains fixed in place behind the experience
And a full-width dark band sits in the vertical center of the viewport
And the band's left column reads, top to bottom:
  | XWALK KEYBOARDS // WATCH (mint section label) |
  | CROSSWALKS. / KEYBOARDS. (two-line headline)  |
  | a short mint rule                             |
  | XWalkKeyboards was created at an AI Tinkerers hackathon and used NYC DOT traffic cam video and Roboflow computer vision to transform crosswalks into piano keyboards. |
  | More details at vinceallen.com                |
And "AI Tinkerers hackathon", "Roboflow", and "vinceallen.com" are mint links that open in a new tab
And the band's right column holds a 16:9 embedded YouTube player for the introduction video
And no camera links, inference, stripe highlights, or synthesized audio are on the page
```

### As a visitor, I can watch the introduction video in place

The video plays inside the page through YouTube's own player, so its
controls, sound, and fullscreen behave as they do on YouTube. The embed is
privacy-enhanced and loads only as the band approaches the viewport.

```gherkin
Given the introduction band is in view
When the visitor selects the YouTube play control
Then the introduction video plays inline with sound
And the live traffic-camera background keeps playing behind the band
And the visitor can pause, change volume, and enter fullscreen from the player controls

Given the homepage loads
Then the player is embedded from youtube-nocookie.com
And the embed is lazy-loaded rather than fetched with the hero
```

### As a visitor on a phone, the introduction stacks into one column

```gherkin
Given a visitor opens the homepage on a mobile viewport and scrolls past the hero
Then the band stacks: section label, headline, rule, description, video
And the video spans the content width at 16:9
```

### As a visitor, an old Realtime link brings me to the homepage

Links to the retired study were shared while it was live. They land on the
homepage rather than a missing page.

```gherkin
Given a visitor opens "/realtime" or "/realtime/<camera ID>"
Then they are permanently redirected to the homepage
And the homepage opens in its initial hero state
```

### As a visitor, the background video stream is ambient

The homepage background video plays camera 5059's live feed for visual
atmosphere only.

```gherkin
When the homepage loads
Then the West Street at W. 23 St background video stream plays normally
And the background video remains darkened as ambient visual atmosphere
And no inference, stripe highlights, or audio are started by the background
And the feed status reads the camera's connection state (e.g., "FEED LIVE // WEST STREET @ W23 ST")
```

## Shared Navigation

### As a visitor, I can return to the XWALK KEYBOARDS homepage

The XWALK KEYBOARDS wordmark in the upper-left is the persistent route back to
the homepage from every internal page.

```gherkin
Given I am viewing the About page or the Camera Registry
When I select the "XWALK KEYBOARDS" wordmark in the upper-left
Then I am returned to the XWALK KEYBOARDS homepage
And the homepage opens in its initial hero state
```

### As a visitor, I can open the About page from the footer

The footer provides a persistent link to the About page from the homepage and
the Camera Registry. On the About page itself the link is rendered as plain
text. Full About-page scenarios are in the [About](#about) section.

```gherkin
Given I am viewing the XWALK KEYBOARDS homepage or the Camera Registry
Then the footer includes an "ABOUT" link
When I select the "ABOUT" link
Then I am taken to the About page
```

### As a visitor, the footer credits the tools that power the site

Live cameras come from more than one provider, so the footer names none of
them. It carries the About link and the tools the project was built with, and it
reads the same on every page and at every viewport width.

```gherkin
Given I am viewing the homepage, the Camera Registry, or the About page
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
are down. The list comes from the camera
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
