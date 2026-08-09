import { defineConfig } from "vitest/config";

// Unit tests are co-located with their source. The Playwright specs in e2e/
// share the .spec.ts suffix, so exclude them from the vitest run.
export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
