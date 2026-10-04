import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "camera-registry");
const HLS_FIXTURE_DIR = join(__dirname, "fixtures", "hls");
const HLS_FIXTURE_PLAYLIST = readFileSync(join(HLS_FIXTURE_DIR, "playlist.m3u8"));
const HLS_FIXTURE_SEGMENT = readFileSync(join(HLS_FIXTURE_DIR, "segment-000000.mpegts"));

/** The camera whose feed this test takes down, to exercise the unavailable card. */
const DOWN_CAMERA = 5056;

/**
 * Every registered live camera plays the offline HLS fixture except
 * DOWN_CAMERA, whose proxy answers 504 as a dead upstream does. Which real
 * camera is up at any moment is live provider state, not this page's layout.
 */
async function serveFeeds(page: Page) {
  await page.route("**/api/hls/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith(`/api/hls/${DOWN_CAMERA}/`)) {
      return route.fulfill({ body: "Upstream timed out", status: 504 });
    }
    if (url.pathname.endsWith("/playlist.m3u8")) {
      return route.fulfill({ body: HLS_FIXTURE_PLAYLIST, contentType: "application/vnd.apple.mpegurl" });
    }
    if (url.pathname.endsWith("/segment-000000.mpegts")) {
      return route.fulfill({ body: HLS_FIXTURE_SEGMENT, contentType: "video/mp2t" });
    }
    return route.fulfill({ status: 404 });
  });
}

async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
}

test.describe("Camera Registry", () => {
  test("one live card per registered camera, with a down feed kept in place", async ({ page }) => {
    await serveFeeds(page);
    await page.goto("/camera-registry");

    await expect(page.locator(".site-header")).toContainText("CAMERA REGISTRY");
    const cards = page.locator(".registry-card");
    await expect(cards).toHaveCount(9);
    await expect(cards.locator("h2 .registry-card__label--wide")).toHaveText([
      "CAMERA_01 // VIEW_5056",
      "CAMERA_02 // VIEW_5059",
      "CAMERA_03 // VIEW_5062",
      "CAMERA_04 // VIEW_5072",
      "CAMERA_05 // VIEW_80003",
      "CAMERA_06 // VIEW_80007",
      "CAMERA_07 // VIEW_80009",
      "CAMERA_08 // VIEW_80027",
      "CAMERA_09 // VIEW_90014",
    ]);
    await expect(cards.nth(1).locator("p")).toHaveText("STREET LOCATION: West Street at W. 23 St");
    // One flat grid: no priority/fallback sections and no live-feed column.
    await expect(page.locator(".section-heading, .live-column")).toHaveCount(0);

    // External links: provider pages only, and none for the private CARLA origin.
    await expect(page.getByRole("link", { name: "Open camera 5059 on 511NY" }))
      .toHaveAttribute("href", "https://511ny.org/map/Cctv/5059");
    await expect(page.getByRole("link", { name: "Open camera 80007 on the City of Bellevue traffic map" }))
      .toHaveAttribute("href", "https://trafficmap.bellevuewa.gov/");
    await expect(cards.nth(8).locator(".registry-card__link")).toHaveCount(0);
    await expect(page.locator(".registry-card__link")).toHaveCount(8);

    // The down feed stays first in the grid and says so; the rest play.
    await expect(cards.nth(0).locator(".live-preview__status")).toHaveText("FEED UNAVAILABLE", { timeout: 15_000 });
    await expect(cards.nth(1).locator(".live-preview__status")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".live-preview__status")).toHaveCount(1, { timeout: 15_000 });

    await freezeAnimations(page);
    await page.screenshot({ fullPage: true, path: join(SHOTS, "camera-registry.png") });
  });

  test("stacks the cards with short labels on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await serveFeeds(page);
    await page.goto("/camera-registry");

    const first = page.locator(".registry-card").first();
    // innerText, because the desktop label variants are still in the DOM, hidden.
    await expect(first.locator("h2")).toHaveText("CAM 01 // 5056", { useInnerText: true });
    await expect(first.locator("p")).toHaveText("WEST STREET AT W. 34 ST", { useInnerText: true });
    await expect(first.locator(".live-preview__status")).toHaveText("FEED UNAVAILABLE", { timeout: 15_000 });
    await expect(page.locator(".live-preview__status")).toHaveCount(1, { timeout: 15_000 });

    const [a, b] = await page.locator(".registry-card").evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => element.getBoundingClientRect().left));
    expect(a).toBe(b);

    await freezeAnimations(page);
    await page.screenshot({ fullPage: true, path: join(SHOTS, "mobile", "camera-registry.png") });
  });
});
