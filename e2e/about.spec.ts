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
    await expect(feedStatus).toContainText("WEST STREET @ W34 ST");

    // Dark viewport panel with the project description.
    const viewport = page.locator(".about-viewport");
    await expect(viewport).toBeVisible();
    const body = viewport.locator("p");
    await expect(body).toContainText("transform crosswalks into piano keyboards");

    // Video wash overlay is rendered.
    await expect(page.locator(".about-video-wash")).toBeAttached();

    // Footer shows ABOUT as plain text (no self-link) on this page.
    const footer = page.locator(".site-footer");
    await expect(footer).toContainText("SOURCE: 511NY // ABOUT");
    await expect(footer.getByRole("link", { name: "ABOUT" })).toHaveCount(0);

    await page.screenshot({ fullPage: true, path: join(SHOTS, "about-page.png") });
  });

  test("footer links to About from other pages", async ({ page }) => {
    await page.goto("/camera-registry");
    const aboutLink = page.locator(".site-footer").getByRole("link", { name: "ABOUT" });
    await expect(aboutLink).toHaveAttribute("href", "/about");
  });
});
