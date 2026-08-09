import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const SHOTS = join(__dirname, "__screens__", "camera-registry");
const STILLS = [
  "videoframe_104668.png",
  "videoframe_106616.png",
  "videoframe_5201.png",
  "videoframe_61718.png",
].map((name) => readFileSync(join(__dirname, "..", "docs", "images", name)));

test.describe("Camera Registry", () => {
  test("priority grid, fallback grid, and live feeds column", async ({ page }) => {
    // Every card resolves "active" with a real View-5056 still, round-robined
    // across the 16 static cameras. Which specific camera is up, down, or
    // under maintenance at any moment is live 511NY state, not part of this
    // page's layout — the "unavailable" card treatment is exercised by
    // camera-maintenance.test.ts instead.
    let stillIndex = 0;
    await page.route("**/api/snapshot/**", (route) => {
      const body = STILLS[stillIndex % STILLS.length];
      stillIndex += 1;
      route.fulfill({ body, contentType: "image/png", headers: { "x-camera-status": "active" } });
    });

    await page.goto("/camera-registry");
    await expect(page.locator(".camera-card")).toHaveCount(16);
    await expect(page.locator(".camera-card img")).toHaveCount(16);

    await page.addStyleTag({
      content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
    });
    await page.screenshot({ fullPage: true, path: join(SHOTS, "camera-registry.png") });
  });
});
