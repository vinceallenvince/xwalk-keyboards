import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests are co-located with their source. The Playwright specs in e2e/
// share the .spec.ts suffix, so exclude them from the vitest run.
export default defineConfig({
  resolve: {
    // Mirror the "@/*" -> "./src/*" mapping in tsconfig.json so tests can
    // import modules that use the alias internally.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
