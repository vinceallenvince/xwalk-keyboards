import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "realtime-study");
const CAMERA_STILL = join(__dirname, "..", "docs", "images", "videoframe_104668.png");
const CALIBRATION_FALLBACK = join(__dirname, "..", "public", "calibration-fallback-5056.json");
const CARLA_CALIBRATION_FALLBACK = join(__dirname, "..", "public", "calibration-fallback-90014.json");
const HLS_FIXTURE_DIR = join(__dirname, "fixtures", "hls");
const HLS_FIXTURE_PLAYLIST = readFileSync(join(HLS_FIXTURE_DIR, "playlist.m3u8"), "utf8");
const HLS_FIXTURE_SEGMENT = readFileSync(join(HLS_FIXTURE_DIR, "segment-000000.mpegts"));

/**
 * Realtime depends on two live services that are neither available nor stable
 * in a test run: the 511NY HLS stream and a Roboflow WebRTC GPU session. Both
 * routes are left hanging rather than aborted, so hls.js and the inference
 * client sit in their real "connecting"/"starting" states instead of tripping
 * their error-and-retry paths.
 *
 * The camera is driven live the same way the homepage spec does it: a still
 * from View 5056 stands in as the video poster and the `playing` event the
 * component already listens for is dispatched, so the real status-to-label
 * mapping produces "FEED LIVE // ...".
 *
 * The onboarding sequence runs on every visit, so tests that are not about it
 * open the study with the `?onboarding=off` override instead of clicking
 * through three steps first.
 */
async function openRealtime(page: Page, { onboarding = false } = {}) {
  await page.route("**/api/hls/**", () => new Promise(() => {}));
  await page.route("**/api/roboflow/**", () => new Promise(() => {}));
  await page.route("**/__fixture/camera-still.png", (route) =>
    route.fulfill({ body: readFileSync(CAMERA_STILL), contentType: "image/png" }),
  );

  await page.goto(onboarding ? "/realtime" : "/realtime?onboarding=off");
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
}

/**
 * Serve a real calibration payload with a chosen status, so the conditions
 * readout is deterministic. The public fallback snapshot is a genuine agent
 * publish — reusing it keeps the stripes/boundaries valid enough for
 * `applyCalibration` to accept the payload.
 */
async function stubCalibration(page: Page, status: string) {
  const payload = { ...JSON.parse(readFileSync(CALIBRATION_FALLBACK, "utf8")), status };
  await page.route("**/api/calibration/**", (route) => route.fulfill({ json: payload }));
}

/** Leave the calibration fetch hanging so no live payload ever arrives. */
async function blockCalibration(page: Page) {
  await page.route("**/api/calibration/**", () => new Promise(() => {}));
}

async function driveCameraLive(page: Page) {
  const video = page.locator(".realtime-viewport video");
  await video.waitFor({ state: "attached" });
  await video.evaluate((element: HTMLVideoElement) => {
    element.poster = "/__fixture/camera-still.png";
    element.dispatchEvent(new Event("playing"));
  });
}

/**
 * Serve a real, finite 352 x 240 HLS presentation entirely from test files.
 * hls.js parses and transmuxes the manifest/segment exactly as it does for the
 * CARLA proxy; only the network transport is replaced, so no VM or GPU is
 * involved.
 */
async function serveCarlaHlsFixture(page: Page) {
  await page.route("**/api/hls/90014/playlist.m3u8*", (route) => route.fulfill({
    body: HLS_FIXTURE_PLAYLIST,
    contentType: "application/vnd.apple.mpegurl",
  }));
  await page.route("**/api/hls/90014/segment-000000.mpegts*", (route) => route.fulfill({
    body: HLS_FIXTURE_SEGMENT,
    contentType: "video/mp2t",
  }));
}

async function openCarlaFixture(page: Page) {
  await serveCarlaHlsFixture(page);
  await page.route("**/api/roboflow/**", () => new Promise(() => {}));
  await page.route("**/api/calibration/**", (route) => route.fulfill({
    json: JSON.parse(readFileSync(CARLA_CALIBRATION_FALLBACK, "utf8")),
  }));
  await page.goto("/realtime/90014?onboarding=off");
  await expect(page.locator(".realtime-feed-status")).toHaveText(
    "FEED LIVE // CARLA TOWN10 @ XWALK 14",
    { timeout: 15_000 },
  );
}

test.describe("Realtime operator tools", () => {
  test("registers the CARLA page while unknown camera IDs stay 404", async ({ page }) => {
    await page.route("**/api/hls/**", () => new Promise(() => {}));
    await page.route("**/api/roboflow/**", () => new Promise(() => {}));
    await page.route("**/api/calibration/**", () => new Promise(() => {}));

    const carlaResponse = await page.goto("/realtime/90014?onboarding=off");
    expect(carlaResponse?.status()).toBe(200);
    await expect(page.locator(".realtime-feed-status")).toContainText(
      "CARLA TOWN10 @ XWALK 14",
    );

    const unknownResponse = await page.goto("/realtime/99999");
    expect(unknownResponse?.status()).toBe(404);
  });

  test("CARLA origin failures become a visible feed-down state after bounded retries", async ({ page }) => {
    await page.route("**/api/hls/90014/**", (route) => route.fulfill({ status: 502 }));
    await page.route("**/api/roboflow/**", () => new Promise(() => {}));
    await page.route("**/api/calibration/**", () => new Promise(() => {}));

    await page.goto("/realtime/90014?onboarding=off");

    await expect(page.locator(".realtime-feed-status")).toHaveText(
      "FEED RECONNECTING // CARLA TOWN10 @ XWALK 14",
    );
    await expect(page.locator(".realtime-feed-status")).toHaveText(
      "FEED DOWN // CARLA TOWN10 @ XWALK 14",
      { timeout: 10_000 },
    );
    await expect(page.getByText("VIDEO FEED UNAVAILABLE", { exact: true })).toBeVisible();
    await expect(page.getByText("HOW TO HEAR XWALK KEYBOARDS", { exact: true })).toHaveCount(0);
  });

  test("RECALIBRATE lives in the debug panel, not the status bar", async ({ page }) => {
    await openRealtime(page);
    await driveCameraLive(page);

    // The status bar is visitor-facing copy only, even with the feed live.
    await expect(page.locator(".realtime-statusbar")).not.toContainText("RECALIBRATE");

    await page.keyboard.press("Control+Shift+D");
    const panel = page.locator(".realtime-debug-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: "RECALIBRATE" })).toBeVisible();
  });
});

test.describe("CARLA offline HLS lifecycle", () => {
  test("starts from the 352 x 240 fixture and cleans up the player on route change", async ({ page }) => {
    await openCarlaFixture(page);

    const video = page.locator(".realtime-viewport video");
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => [
      element.videoWidth,
      element.videoHeight,
    ])).toEqual([352, 240]);

    await video.evaluate((element: HTMLVideoElement) => {
      const state = { load: 0, pause: 0 };
      const host = window as typeof window & { __hlsCleanup?: typeof state };
      host.__hlsCleanup = state;
      const load = element.load.bind(element);
      const pause = element.pause.bind(element);
      element.load = () => { state.load += 1; load(); };
      element.pause = () => { state.pause += 1; pause(); };
    });

    await page.getByRole("link", { name: "ABOUT" }).first().click();
    await expect(page).toHaveURL(/\/about$/);
    await expect.poll(() => page.evaluate(() => {
      const host = window as typeof window & { __hlsCleanup?: { load: number; pause: number } };
      return Boolean(host.__hlsCleanup && host.__hlsCleanup.load >= 1 && host.__hlsCleanup.pause >= 1);
    })).toBe(true);
  });

  test("supports and exits pseudo-fullscreen while the fixture is playing", async ({ page }) => {
    await openCarlaFixture(page);

    const viewport = page.locator(".realtime-viewport");
    const button = page.locator(".realtime-controls--overlay .realtime-fullscreen-button");
    await page.keyboard.press("Control+Shift+D");
    const panel = page.locator(".realtime-debug-panel");
    await panel.getByRole("button", { name: "FORCE INFERENCE READY" }).click();
    await panel.getByRole("button", { name: "✕" }).click();
    await expect(button).toBeEnabled();

    // Force the WebKit/iOS fallback while leaving the production click handler
    // and its state transitions intact.
    await viewport.evaluate((element: HTMLDivElement) => {
      Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
      element.requestFullscreen = () => Promise.reject(new Error("fixture uses pseudo-fullscreen"));
    });
    await button.click();

    await expect(viewport).toHaveClass(/realtime-viewport--pseudo-fullscreen/);
    await expect(button).toHaveText("EXIT FULLSCREEN");
    await expect(page.locator(".realtime-fullscreen-exit-layer")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(viewport).not.toHaveClass(/realtime-viewport--pseudo-fullscreen/);
    await expect(button).toHaveText("FULLSCREEN");
    await expect(page.locator(".realtime-fullscreen-exit-layer")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  });

  test("pauses inference after five minutes without stopping the feed", async ({ page }) => {
    await openCarlaFixture(page);
    await page.clock.install();
    await page.keyboard.press("Control+Shift+D");
    const panel = page.locator(".realtime-debug-panel");
    await panel.getByRole("button", { name: "FORCE INFERENCE READY" }).click();
    await expect(page.locator(".realtime-inference-status")).toHaveText("STATUS: KEYBOARD READY!");
    await panel.getByRole("button", { name: "✕" }).click();

    await page.clock.fastForward(5 * 60 * 1000);

    await expect(page.locator(".realtime-pause-modal")).toBeVisible();
    await expect(page.locator(".realtime-pause-modal__subtitle")).toContainText("after five minutes");
    await expect(page.locator(".realtime-feed-status")).toContainText("FEED LIVE");
    await expect(page.locator(".realtime-viewport video")).toHaveJSProperty("paused", false);

    await page.getByRole("button", { name: "CONTINUE" }).click();
    await expect(page.locator(".realtime-pause-modal")).toHaveCount(0);
    await expect(page.locator(".realtime-inference-status")).toContainText("WARMING UP");

    await page.keyboard.press("Control+Shift+D");
    await panel.getByRole("button", { name: "FORCE INFERENCE READY" }).click();
    await panel.getByRole("button", { name: "✕" }).click();
    await page.clock.fastForward(5 * 60 * 1000);
    await page.getByRole("button", { name: "CLOSE" }).click();
    await expect(page.locator(".realtime-inference-status")).toHaveText(
      "XWALK KEYBOARD PAUSED: RELOAD TO CONTINUE",
    );
    await expect(page.locator(".realtime-feed-status")).toContainText("FEED LIVE");
  });
});

test.describe("Realtime onboarding", () => {
  const panel = (page: Page) => page.locator(".realtime-onboarding-panel");
  const title = (page: Page) => page.locator(".realtime-onboarding__title");
  const nextButton = (page: Page) => page.locator(".realtime-onboarding__btn");
  const infoButton = (page: Page) => page.locator(".realtime-onboarding-button");

  test("opens on the how-to-hear step over the connecting study", async ({ page }) => {
    await blockCalibration(page);
    await openRealtime(page, { onboarding: true });

    await expect(panel(page)).toBeVisible();
    await expect(title(page)).toHaveText("HOW TO HEAR XWALK KEYBOARDS");
    await expect(panel(page)).toContainText("Each white stripe is a key.");
    await expect(panel(page)).toContainText("It takes a few seconds for the keyboard to warm up.");
    await expect(nextButton(page)).toHaveText("NEXT");

    // The study keeps starting up behind the overlay rather than waiting on
    // the visitor: both statuses stay truthful, neither implies it waits on
    // the other, and the controls sit visibly inactive. No spinner exists.
    await expect(page.locator(".realtime-feed-status")).toHaveText("CONNECTING // WEST STREET @ W34 ST");
    await expect(page.locator(".realtime-inference-status")).toHaveText("STATUS: KEYBOARD WARMING UP...");
    await expect(page.locator(".realtime-controls--idle:visible")).toBeVisible();
    await expect(page.locator(".realtime-sound-button:visible")).toBeDisabled();

    // The camera going live changes the feed line behind the overlay without
    // touching the sequence.
    await driveCameraLive(page);
    await expect(page.locator(".realtime-feed-status")).toHaveText("FEED LIVE // WEST STREET @ W34 ST");
    await expect(title(page)).toHaveText("HOW TO HEAR XWALK KEYBOARDS");
    await page.screenshot({ path: join(SHOTS, "realtime-onboarding-how-to-hear.png") });
  });

  test("NEXT advances to a conditions readout derived from the calibration payload", async ({ page }) => {
    await stubCalibration(page, "degraded");
    await openRealtime(page, { onboarding: true });

    await nextButton(page).click();
    await expect(title(page)).toHaveText("XWALK KEYBOARDS BEST CONDITIONS");
    await expect(panel(page)).toContainText("Keyboard detection works best when the camera has");
    await expect(panel(page)).toContainText("Your keyboard conditions: FAIR");
    await expect(page.locator(".realtime-onboarding__value--fair")).toBeVisible();
    await expect(panel(page)).toContainText("Bad weather, shadows or obstructions may affect");
    await expect(nextButton(page)).toHaveText("NEXT");
  });

  test("the conditions readout is omitted when no calibration has arrived", async ({ page }) => {
    await blockCalibration(page);
    await openRealtime(page, { onboarding: true });
    await driveCameraLive(page);

    await nextButton(page).click();
    await expect(title(page)).toHaveText("XWALK KEYBOARDS BEST CONDITIONS");
    // No reading is claimed rather than a made-up one; the caveat stays.
    await expect(panel(page)).not.toContainText("Your keyboard conditions:");
    await expect(panel(page)).toContainText("Bad weather, shadows or obstructions may affect");
    await page.screenshot({ path: join(SHOTS, "realtime-onboarding-conditions-unknown.png") });
  });

  test("?conditions= forces a readout variant for review", async ({ page }) => {
    await blockCalibration(page);
    await page.route("**/api/hls/**", () => new Promise(() => {}));
    await page.route("**/api/roboflow/**", () => new Promise(() => {}));

    await page.goto("/realtime?conditions=bad");
    await nextButton(page).click();
    await expect(panel(page)).toContainText("Your keyboard conditions: BAD");
    await expect(page.locator(".realtime-onboarding__value--bad")).toBeVisible();
    await expect(panel(page)).toContainText("Bad weather, shadows or obstructions may affect");

    // GOOD is the one level that carries no caveat.
    await page.goto("/realtime?conditions=good");
    await nextButton(page).click();
    await expect(panel(page)).toContainText("Your keyboard conditions: GOOD");
    await expect(page.locator(".realtime-onboarding__value--good")).toBeVisible();
    await expect(panel(page)).not.toContainText("Bad weather, shadows or obstructions may affect");
  });

  test("the warming-up step has no dismissal control and waits on predictions", async ({ page }) => {
    await blockCalibration(page);
    await openRealtime(page, { onboarding: true });
    await driveCameraLive(page);

    await nextButton(page).click();
    await nextButton(page).click();
    await expect(title(page)).toHaveText("WARMING UP ...");
    await expect(panel(page)).toContainText("XWalk Keyboards take a few seconds to a minute");
    await expect(panel(page)).toContainText("Meanwhile, check that your speakers are on!");
    // No button, no scrim dismissal: only real predictions clear this step,
    // and none can arrive in this environment.
    await expect(nextButton(page)).toHaveCount(0);
    await page.locator(".realtime-onboarding-scrim").click({ position: { x: 10, y: 10 } });
    await expect(panel(page)).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "realtime-onboarding-warming-up.png") });
  });

  test("the sequence runs again on every visit", async ({ page }) => {
    await blockCalibration(page);
    await openRealtime(page, { onboarding: true });
    await nextButton(page).click();
    await expect(title(page)).toHaveText("XWALK KEYBOARDS BEST CONDITIONS");

    await page.reload();
    await expect(title(page)).toHaveText("HOW TO HEAR XWALK KEYBOARDS");
  });

  test("the info icon is absent until predictions arrive", async ({ page }) => {
    // Predictions never arrive in this environment, so the icon never renders —
    // neither during the sequence nor after skipping it.
    await openRealtime(page, { onboarding: true });
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(infoButton(page)).toHaveCount(0);

    await openRealtime(page);
    await driveCameraLive(page);
    await expect(infoButton(page)).toHaveCount(0);
  });

  test("the pause modal owns the viewport alone", async ({ page }) => {
    await blockCalibration(page);
    await openRealtime(page, { onboarding: true });
    await driveCameraLive(page);
    await expect(panel(page)).toBeVisible();

    // The debug menu's force-pause is the only deterministic way to reach the
    // five-minute state without waiting five minutes.
    await page.keyboard.press("Control+Shift+D");
    await page.getByRole("button", { name: /force pause/i }).click();

    await expect(page.locator(".realtime-pause-modal")).toBeVisible();
    await expect(page.locator(".realtime-pause-modal__title")).toHaveText("XWALK KEYBOARD PAUSED");
    await expect(panel(page)).toHaveCount(0);
    await expect(infoButton(page)).toHaveCount(0);
  });
});
