import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "realtime-study");
const CAMERA_STILL = join(__dirname, "..", "docs", "images", "videoframe_104668.png");

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
 */
/**
 * A fresh context has no seen-flag, so the first-visit instructions would cover
 * every other state. Tests that are not about the modal seed the flag before
 * the page script runs; the modal's own tests pass `firstVisit`.
 */
async function openRealtime(page: Page, { firstVisit = false } = {}) {
  await page.route("**/api/hls/**", () => new Promise(() => {}));
  await page.route("**/api/roboflow/**", () => new Promise(() => {}));
  await page.route("**/__fixture/camera-still.png", (route) =>
    route.fulfill({ body: readFileSync(CAMERA_STILL), contentType: "image/png" }),
  );
  if (!firstVisit) {
    await page.addInitScript(() =>
      window.localStorage.setItem("xwalkKeyboards.realtimeIntroSeen", "true"),
    );
  }

  await page.goto("/realtime");
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
}

async function driveCameraLive(page: Page) {
  const video = page.locator(".realtime-viewport video");
  await video.waitFor({ state: "attached" });
  await video.evaluate((element: HTMLVideoElement) => {
    element.poster = "/__fixture/camera-still.png";
    element.dispatchEvent(new Event("playing"));
  });
}

test.describe("Realtime", () => {
  test("camera connecting and inference starting", async ({ page }) => {
    await openRealtime(page);
    await expect(page.locator(".realtime-feed-status")).toHaveText("CONNECTING // WEST STREET @ W34 ST");
    await expect(page.locator(".realtime-inference-status")).toHaveText("STATUS: KEYBOARD WARMING UP...");
    // Both controls are present but visually inactive before the feed is live.
    await expect(page.locator(".realtime-controls--idle")).toBeVisible();
    await expect(page.locator(".realtime-sound-button")).toBeDisabled();
    await page.screenshot({ path: join(SHOTS, "realtime-both-loading.png") });
  });

  test("camera live while inference is still starting", async ({ page }) => {
    await openRealtime(page);
    await driveCameraLive(page);
    await expect(page.locator(".realtime-feed-status")).toHaveText("FEED LIVE // WEST STREET @ W34 ST");
    await expect(page.locator(".realtime-inference-status")).toHaveText("STATUS: KEYBOARD WARMING UP...");
    await page.screenshot({ path: join(SHOTS, "realtime-cam-ready.png") });
  });
});

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

test.describe("Realtime instructions", () => {
  const modal = (page: Page) => page.locator(".realtime-intro-modal");
  const introButton = (page: Page) => page.locator(".realtime-intro-button");

  test("first visit is met by the instructions", async ({ page }) => {
    await openRealtime(page, { firstVisit: true });

    await expect(modal(page)).toBeVisible();
    await expect(page.locator(".realtime-intro-modal__title")).toHaveText("HOW TO HEAR XWALK KEYBOARDS");
    await expect(modal(page)).toContainText("Each white stripe is a key.");
    await expect(modal(page)).toContainText("It takes a few seconds for the keyboard to warm up.");
    await expect(page.locator(".realtime-intro-modal__btn")).toHaveText("CLOSE");
    // The study keeps starting up behind the scrim rather than waiting on the
    // visitor to finish reading.
    await expect(page.locator(".realtime-inference-status")).toHaveText("STATUS: KEYBOARD WARMING UP...");
    await page.screenshot({ path: join(SHOTS, "realtime-intro-first-visit.png") });
  });

  test("closing records the visit so it does not reappear", async ({ page }) => {
    await openRealtime(page, { firstVisit: true });
    await page.locator(".realtime-intro-modal__btn").click();
    await expect(modal(page)).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".realtime-statusbar")).toBeVisible();
    await expect(modal(page)).toHaveCount(0);
  });

  test("the header icon reopens the instructions", async ({ page }) => {
    await openRealtime(page);
    await driveCameraLive(page);
    await expect(modal(page)).toHaveCount(0);
    await page.screenshot({ path: join(SHOTS, "realtime-intro-icon.png") });

    await introButton(page).click();
    await expect(modal(page)).toBeVisible();
    // Reopening leaves the study running behind it.
    await expect(page.locator(".realtime-feed-status")).toHaveText("FEED LIVE // WEST STREET @ W34 ST");
    await page.screenshot({ path: join(SHOTS, "realtime-intro-reopened.png") });

    await page.keyboard.press("Escape");
    await expect(modal(page)).toHaveCount(0);
  });

  test("a scrim click dismisses the instructions", async ({ page }) => {
    await openRealtime(page, { firstVisit: true });
    await page.locator(".realtime-intro-scrim").click({ position: { x: 10, y: 10 } });
    await expect(modal(page)).toHaveCount(0);
  });

  test("the pause modal owns the viewport alone", async ({ page }) => {
    await openRealtime(page);
    await driveCameraLive(page);
    // The debug menu's force-pause is the only deterministic way to reach the
    // five-minute state without waiting five minutes.
    await page.keyboard.press("Control+Shift+D");
    await page.getByRole("button", { name: /force pause/i }).click();

    await expect(page.locator(".realtime-pause-modal")).toBeVisible();
    await expect(page.locator(".realtime-pause-modal__title")).toHaveText("XWALK KEYBOARD PAUSED");
    await expect(modal(page)).toHaveCount(0);
    await expect(introButton(page)).toHaveCount(0);
  });
});
