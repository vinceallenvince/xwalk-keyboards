import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "homepage");
const CAMERA_STILL = join(__dirname, "fixtures", "511ny-5059-frame.png");

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
 * The YouTube embed is stubbed with a blank document so runs stay offline and
 * screenshots don't depend on YouTube's player.
 */
async function openLiveHomepage(page: Page) {
  await page.route("**/api/hls/**", () => new Promise(() => {}));
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ body: "<!doctype html><body style=\"margin:0;background:#000\"></body>", contentType: "text/html" }),
  );
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

async function showIntroduction(page: Page) {
  await page.getByRole("link", { name: "SCROLL" }).click();
  await expect(page.locator(".home-watch__band")).toBeInViewport();
}

test.describe("Homepage", () => {
  test("hero over the live camera background", async ({ page }) => {
    await openLiveHomepage(page);
    await expect(page.getByRole("heading", { name: "XWALK KEYBOARDS" })).toBeVisible();
    await page.screenshot({ path: join(SHOTS, "homepage-initial.png") });
  });

  test("scrolling reveals the introduction video band", async ({ page }) => {
    await openLiveHomepage(page);
    await showIntroduction(page);

    const band = page.locator(".home-watch__band");
    await expect(band.locator(".home-watch__label")).toHaveText("XWALK KEYBOARDS // WATCH");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("THE STREET.THE RHYTHM.");
    await expect(band.locator(".home-watch__sound")).toHaveText("FOR BEST EXPERIENCE, TURN ON YOUR SPEAKERS");
    await expect(band.locator("iframe")).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/buOyciFqpY4\?/);
    await expect(band.locator("iframe")).toHaveAttribute("loading", "lazy");
    // The retired camera selector is gone, and nothing links to /realtime.
    await expect(page.locator('a[href^="/realtime"]')).toHaveCount(0);
    await page.screenshot({ path: join(SHOTS, "homepage-scrolled-video.png") });
  });

  test("on a phone the sound prompt sits under the video", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLiveHomepage(page);
    await showIntroduction(page);

    const video = await page.locator(".intro-video").boundingBox();
    const sound = await page.locator(".home-watch__sound").boundingBox();
    expect(video).not.toBeNull();
    expect(sound!.y).toBeGreaterThanOrEqual(video!.y + video!.height);
    await page.screenshot({ path: join(SHOTS, "mobile", "homepage-scrolled-video.png") });
  });

  test("old Realtime links land on the homepage", async ({ page }) => {
    await openLiveHomepage(page);
    for (const path of ["/realtime", "/realtime/5059"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "XWALK KEYBOARDS" })).toBeVisible();
    }
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
