import { expect, test } from "@playwright/test";

// Read-only smoke test for a deployed site (playwright.smoke.config.ts).

test("sign-in page loads and signed-out pages redirect", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in code" })).toBeVisible();

  await page.goto("/field");
  await expect(page).toHaveURL(/\/login\?next=%2Ffield$/);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/login");
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=(self)");
});

test("app manifest and service worker are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).name).toBe("Facade Report");

  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect(await sw.text()).toContain("cacheShell");
});

test("report downloads need a signed-in user", async ({ request }) => {
  const res = await request.get("/projects/00000000-0000-0000-0000-000000000000/report", { maxRedirects: 0 });
  expect([307, 401, 404]).toContain(res.status());
});
