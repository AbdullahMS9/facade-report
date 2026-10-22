import { defineConfig, devices } from "@playwright/test";

// End-to-end flows against `npm run dev` and local Supabase (`npm run db:start`).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
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
      // A dev server you already have running is reused, but then it must have
      // been started with NYC_OPEN_DATA_URL pointing at the fake.
      command: "npm run dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      timeout: 120_000,
      env: { NYC_OPEN_DATA_URL: "http://127.0.0.1:4010/resource/xubg-57si.json" },
    },
  ],
});
