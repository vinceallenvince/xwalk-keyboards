import { defineConfig, devices } from "@playwright/test";

// Layer 1 of the visual review: capture one screenshot per Figma UI frame.
// The viewport matches the 1440 x 900 Figma frames so the advisory Layer 2
// comparison (.claude/skills/figma-alignment) comes down to design intent
// rather than viewport differences.
export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  outputDir: "e2e/__results__",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  reporter: [["list"]],
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3000", deviceScaleFactor: 1 },
  webServer: {
    command: "pnpm build && pnpm start --port 3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    url: "http://127.0.0.1:3000/api/health",
  },
});
