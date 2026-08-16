import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "realtime-study");
const CAMERA_STILL = join(__dirname, "..", "docs", "images", "videoframe_104668.png");
const CALIBRATION_FALLBACK = join(__dirname, "..", "public", "calibration-fallback-5056.json");

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

test.describe("Realtime operator tools", () => {
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
    await expect(page.locator(".realtime-controls--idle")).toBeVisible();
    await expect(page.locator(".realtime-sound-button")).toBeDisabled();

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
