import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "homepage");
const CAMERA_STILL = join(__dirname, "fixtures", "511ny-5059-frame.png");

type CameraStatus = { cameraId: number; status: string; crosswalkRank: number };

// Includes the unlisted Bellevue cameras (80003, 80009, 80027): the status
// route reports them, and the selector must still leave them out (VIN-86).
const ALL_CAMERAS_OK: CameraStatus[] = [5056, 5059, 5062, 5072, 80003, 80007, 80009, 80027, 90014]
  .map((cameraId) => ({ cameraId, status: "ok", crosswalkRank: 3 }));

/**
 * The homepage background is a live 511NY HLS stream, which is neither
 * available nor stable in a test run. Rather than screenshot a black viewport,
 * stand in a real frame from the same camera and drive the component into the
 * "live" state it reaches in production:
 *
 *  - the HLS route is left hanging, so hls.js neither succeeds nor trips its
 *    error/retry path within the life of the test;
 *  - a still from 511NY View 5059 is served as the video poster, so the
 *    darkened traffic background is present and identical on every run;
 *  - the `playing` event the component already listens for is dispatched, so
 *    the real status-to-label mapping produces "FEED LIVE // ...".
 *
 * Camera statuses are stubbed too: the real route probes every upstream
 * playlist, so its answer would depend on which feeds are up today.
 */
type StatusHandler = Parameters<Page["route"]>[1];

async function openLiveHomepage(page: Page, statuses: CameraStatus[] | StatusHandler = ALL_CAMERAS_OK) {
  await page.route("**/api/calibration/status", typeof statuses === "function"
    ? statuses
    : (route) => route.fulfill({ json: { cameras: statuses } }));
  await page.route("**/api/hls/**", () => new Promise(() => {}));
  await page.route("**/__fixture/camera-still.png", (route) =>
    route.fulfill({ body: readFileSync(CAMERA_STILL), contentType: "image/png" }),
  );

  await page.goto("/");

  const video = page.locator("video.home-video-background");
  await video.waitFor({ state: "attached" });
  await video.evaluate((element: HTMLVideoElement) => {
    element.poster = "/__fixture/camera-still.png";
    element.dispatchEvent(new Event("playing"));
  });

  // Freeze transitions and smooth scrolling so hover states are captured fully
  // settled rather than mid-fade.
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; } html { scroll-behavior: auto !important; }",
  });
  await expect(page.locator(".home-feed-status")).toHaveText("FEED LIVE // WEST STREET @ W23 ST");
}

async function showSelector(page: Page) {
  await page.locator("#studies").scrollIntoViewIfNeeded();
  await expect(page.locator(".study-selector")).toBeInViewport();
}

test.describe("Homepage", () => {
  test("hero over the live camera background", async ({ page }) => {
    await openLiveHomepage(page);
    await expect(page.getByRole("heading", { name: "XWALK KEYBOARDS" })).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "homepage-initial.png") });
  });

  test("camera selector, no link previewed", async ({ page }) => {
    await openLiveHomepage(page);
    await showSelector(page);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: join(SHOTS, "homepage-scrolled-inactive.png") });
  });

  test("camera selector, 5059 previewed", async ({ page }) => {
    await openLiveHomepage(page);
    await showSelector(page);
    await page.getByRole("link", { name: "CAM 5059" }).hover();
    await page.screenshot({ path: join(SHOTS, "homepage-scrolled-realtime.png") });
  });

  test("camera selector lists every available listed camera, ties by descending ID", async ({ page }) => {
    await openLiveHomepage(page);
    await showSelector(page);
    await expect(page.locator(".study-selector a")).toHaveText([
      "CAM 90014", "CAM 80007", "CAM 5072", "CAM 5062", "CAM 5059", "CAM 5056",
    ]);
    await expect(page.getByRole("link", { name: "CAM 80007" }))
      .toHaveAttribute("href", "/realtime/80007");
  });

  test("camera selector excludes CARLA while its feed is down", async ({ page }) => {
    await openLiveHomepage(page, ALL_CAMERAS_OK.map((camera) => (
      camera.cameraId === 90014 ? { ...camera, status: "feed_down" } : camera
    )));
    await showSelector(page);

    await expect(page.locator(".study-selector a")).toHaveCount(5);
    await expect(page.getByRole("link", { name: "CAM 90014" })).toHaveCount(0);
  });

  test("camera selector drops every 511NY camera whose feed is down", async ({ page }) => {
    await openLiveHomepage(page, ALL_CAMERAS_OK.map((camera) => (
      camera.cameraId < 10000 ? { ...camera, status: "feed_down" } : camera
    )));
    await showSelector(page);

    await expect(page.locator(".study-selector a")).toHaveText(["CAM 90014", "CAM 80007"]);
  });

  test("camera selector shows no links until availability is known", async ({ page }) => {
    let releaseStatuses = () => {};
    await openLiveHomepage(page, (route) => new Promise<void>((resolve) => {
      releaseStatuses = () => resolve(route.fulfill({ json: { cameras: ALL_CAMERAS_OK.map((camera) => (
        camera.cameraId < 10000 ? { ...camera, status: "feed_down" } : camera
      )) } }));
    }));
    await showSelector(page);

    const selector = page.locator(".study-selector");
    await expect(selector).toHaveAttribute("aria-busy", "true");
    await expect(selector.locator("a")).toHaveCount(0);
    const pendingBox = await selector.boundingBox();

    releaseStatuses();
    await expect(selector.locator("a")).toHaveText(["CAM 90014", "CAM 80007"]);
    await expect(selector).toHaveAttribute("aria-busy", "false");
    expect(await selector.boundingBox()).toEqual(pendingBox);
  });

  test("camera selector falls back to CAM 5059 when statuses can't be fetched", async ({ page }) => {
    await openLiveHomepage(page, (route) => route.fulfill({ status: 500, body: "" }));
    await showSelector(page);

    await expect(page.locator(".study-selector a")).toHaveText(["CAM 5059"]);
    await expect(page.getByRole("link", { name: "CAM 5059" }))
      .toHaveAttribute("href", "/realtime/5059");
  });

  test("camera selector falls back to CAM 5059 when every feed is down", async ({ page }) => {
    await openLiveHomepage(page, ALL_CAMERAS_OK.map((camera) => ({ ...camera, status: "feed_down" })));
    await showSelector(page);

    await expect(page.locator(".study-selector a")).toHaveText(["CAM 5059"]);
  });

  test("footer credits the tools, not a camera provider", async ({ page }) => {
    await openLiveHomepage(page);
    const footer = page.locator(".home-footer");
    await expect(footer).toHaveText("ABOUT // POWERED BY: Roboflow + Google Cloud Run");
    await expect(footer).not.toContainText("CAM SOURCE");
  });

  test("footer reads the same on a phone, POWERED BY included", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLiveHomepage(page);
    const footer = page.locator(".home-footer");
    await expect(footer).toHaveText("ABOUT // POWERED BY: Roboflow + Google Cloud Run");
    await expect(footer.getByRole("link", { name: "Google Cloud Run" })).toBeVisible();
  });
});
