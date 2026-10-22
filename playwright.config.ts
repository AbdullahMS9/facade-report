import { defineConfig, devices } from "@playwright/test";

// End-to-end flows against a production build on port 3100 (the service worker
// only runs in production builds) and local Supabase (`npm run db:start`).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3100",
    // Field screens are designed for phones (CLAUDE.md §9).
    ...devices["iPhone 13"],
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // Fake NYC Open Data so tests never depend on the city's API.
      command: "node tests/e2e/fake-opendata.mjs",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: true,
    },
    {
      command: "npm run build && npx next start -p 3100",
      url: "http://localhost:3100/login",
      reuseExistingServer: false,
      timeout: 300_000,
      env: { NYC_OPEN_DATA_URL: "http://127.0.0.1:4010/resource/xubg-57si.json" },
    },
  ],
});
