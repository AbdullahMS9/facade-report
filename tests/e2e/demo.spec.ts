import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { deleteUserAndFirm, signInCode, testEmail } from "./support";

// The demo seed (scripts/seed-demo.mjs) produces a working project: two
// intended checker blockers, photos that load, and a report that downloads.
const email = testEmail("e2e-demo");

test.afterAll(async () => {
  await deleteUserAndFirm(email);
});

test("the seeded demo project works", async ({ page }) => {
  execFileSync("node", ["--env-file=.env.local", "scripts/seed-demo.mjs"], {
    env: { ...process.env, DEMO_EMAIL: email },
    stdio: "pipe",
  });

  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByLabel("Sign-in code").fill(await signInCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Demo Facade Engineering (fictional)")).toBeVisible();
  await page.getByRole("link", { name: /123 Demo Street/ }).click();
  await expect(page.getByRole("link", { name: "Checker: 2 blockers" })).toBeVisible();
  await expect(page.getByText("Building status").locator("..").getByText("UNSAFE")).toBeVisible();

  // Exactly the two intended blockers.
  await page.getByRole("link", { name: "Checker: 2 blockers" }).click();
  await expect(page.getByText("Photos of SWARMP and UNSAFE conditions", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("1 prior-cycle item not marked repaired or not repaired.")).toBeVisible();

  // Photos load through signed links.
  await page.getByRole("link", { name: "← 123 Demo Street" }).click();
  await page.getByRole("link", { name: "All observations" }).click();
  await page.getByRole("link", { name: /Coping/ }).click();
  const img = page.getByRole("img", { name: /Photo taken/ });
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1600);

  // The report downloads.
  await page.goto(page.url().replace(/\/observations\/.*/, ""));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download report (.docx)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^FISP Cycle 10 – 123 Demo Street – /);
});
