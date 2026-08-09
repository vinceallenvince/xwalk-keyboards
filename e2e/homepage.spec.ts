import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "homepage");
const CAMERA_STILL = join(__dirname, "..", "docs", "images", "videoframe_104668.png");

/**
 * The homepage background is a live 511NY HLS stream, which is neither
 * available nor stable in a test run. Rather than screenshot a black viewport,
 * stand in a real frame from the same camera and drive the component into the
 * "live" state it reaches in production:
 *
 *  - the HLS route is left hanging, so hls.js neither succeeds nor trips its
 *    error/retry path within the life of the test;
 *  - a still from View 5056 is served as the video poster, so the darkened
 *    traffic background is present and identical on every run;
 *  - the `playing` event the component already listens for is dispatched, so
 *    the real status-to-label mapping produces "FEED LIVE // ...".
 */
async function openLiveHomepage(page: Page) {
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
  await expect(page.locator(".home-feed-status")).toContainText("FEED LIVE");
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

  test("study selector, neither mode previewed", async ({ page }) => {
    await openLiveHomepage(page);
    await showSelector(page);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: join(SHOTS, "homepage-scrolled-inactive.png") });
  });

  test("study selector, Realtime previewed", async ({ page }) => {
    await openLiveHomepage(page);
    await showSelector(page);
    await page.getByRole("link", { name: "REALTIME" }).hover();
    await page.screenshot({ path: join(SHOTS, "homepage-scrolled-realtime.png") });
  });

  test("study selector, Orchestration is disabled", async ({ page }) => {
    await openLiveHomepage(page);
    await showSelector(page);
    // Orchestration is deliberately not yet a live study from the homepage: no
    // link role, no rollover highlight, and clicking it must not navigate.
    await expect(page.getByRole("link", { name: "ORCHESTRATION" })).toHaveCount(0);
    const orchestration = page.getByText("ORCHESTRATION", { exact: true });
    await expect(orchestration).toHaveAttribute("aria-disabled", "true");
    await orchestration.hover();
    await expect(orchestration).toHaveCSS("color", "rgba(255, 255, 255, 0.31)");
    await orchestration.click({ force: true });
    await expect(page).toHaveURL(/\/#studies$|\/$/);
  });
});
