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
async function openRealtime(page: Page) {
  await page.route("**/api/hls/**", () => new Promise(() => {}));
  await page.route("**/api/roboflow/**", () => new Promise(() => {}));
  await page.route("**/__fixture/camera-still.png", (route) =>
    route.fulfill({ body: readFileSync(CAMERA_STILL), contentType: "image/png" }),
  );

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
    await expect(page.locator(".realtime-inference-status")).toHaveText("STARTING ROBOFLOW GPU...");
    // Both controls are present but visually inactive before the feed is live.
    await expect(page.locator(".realtime-controls--idle")).toBeVisible();
    await expect(page.locator(".realtime-sound-button")).toBeDisabled();
    await page.screenshot({ path: join(SHOTS, "realtime-both-loading.png") });
  });

  test("camera live while inference is still starting", async ({ page }) => {
    await openRealtime(page);
    await driveCameraLive(page);
    await expect(page.locator(".realtime-feed-status")).toHaveText("FEED LIVE // WEST STREET @ W34 ST");
    await expect(page.locator(".realtime-inference-status")).toHaveText("STARTING ROBOFLOW GPU...");
    await page.screenshot({ path: join(SHOTS, "realtime-cam-ready.png") });
  });
});
