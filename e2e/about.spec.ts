import { join } from "node:path";

import { expect, test } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "about");

test.describe("About", () => {
  // Prevent HLS proxy requests from hanging the test.
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/hls/**", (route) => route.abort());
  });

  test("page content, header, and footer", async ({ page }) => {
    await page.goto("/about");
    await page.addStyleTag({
      content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
    });

    // Header shows the ABOUT section label without an underline.
    const wordmark = page.locator(".wordmark");
    await expect(wordmark).toContainText("ABOUT");
    await expect(wordmark.locator("u")).toHaveCount(0);

    // Feed status indicator is present.
    const feedStatus = page.locator(".about-feed-status");
    await expect(feedStatus).toBeVisible();
    await expect(feedStatus).toContainText("BELLEVUE WAY @ NE 8TH ST");

    // Dark viewport panel with the project description.
    const viewport = page.locator(".about-viewport");
    await expect(viewport).toBeVisible();
    await expect(viewport).toContainText("uses traffic camera video feeds to transform crosswalks into piano keyboards");
    await expect(viewport).toContainText("detect pedestrians in a traffic cam video in real time");
    // Cameras come from more than one provider, so none is named.
    await expect(viewport).not.toContainText("511NY");
    await expect(viewport).not.toContainText("NYC's network");

    // Video wash overlay is rendered.
    await expect(page.locator(".about-video-wash")).toBeAttached();

    // Footer shows ABOUT as plain text (no self-link) on this page.
    const footer = page.locator(".site-footer");
    await expect(footer).toHaveText("ABOUT // POWERED BY: Roboflow + Google Cloud Run");
    await expect(footer).not.toContainText("CAM SOURCE");
    await expect(footer.getByRole("link", { name: "Roboflow" })).toHaveAttribute("href", "https://roboflow.com");
    await expect(footer.getByRole("link", { name: "ABOUT" })).toHaveCount(0);

    await page.screenshot({ fullPage: true, path: join(SHOTS, "about-page.png") });
  });

  test("footer links to About from other pages", async ({ page }) => {
    await page.goto("/camera-registry");
    const aboutLink = page.locator(".site-footer").getByRole("link", { name: "ABOUT" });
    await expect(aboutLink).toHaveAttribute("href", "/about");
  });
});
