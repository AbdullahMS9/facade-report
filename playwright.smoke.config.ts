import { defineConfig, devices } from "@playwright/test";

// Read-only checks against a deployed site: SMOKE_URL=https://… npm run test:smoke
// Starts no servers and writes no data.
const baseURL = process.env.SMOKE_URL;
if (!baseURL) throw new Error("Set SMOKE_URL, e.g. SMOKE_URL=https://your-app.vercel.app");

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "smoke.spec.ts",
  timeout: 30_000,
  use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 }, baseURL },
});
