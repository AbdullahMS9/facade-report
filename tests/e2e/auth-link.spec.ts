import { expect, test } from "@playwright/test";
import { deleteUserAndFirm, signInLink, testEmail } from "./support";

// Sign-in by emailed link (the stopgap while hosted emails can't carry a code).
const email = testEmail("e2e-link");
const other = testEmail("e2e-link-other");

test.afterAll(async () => {
  await deleteUserAndFirm(email);
  await deleteUserAndFirm(other);
});

test("the emailed link signs you in and keeps where you were going", async ({ page }) => {
  await page.goto("/team"); // signed out → /login?next=/team
  await expect(page).toHaveURL(/\/login\?next=%2Fteam$/);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We emailed ${email}.`)).toBeVisible();

  const link = await signInLink(email);
  expect(link).toContain("/auth/v1/verify");
  await page.goto(link);
  // New user, so /team sends them on to set up a firm.
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("a link opened in a different browser explains what to do", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(other);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We emailed ${other}.`)).toBeVisible();
  const link = await signInLink(other);

  const elsewhere = await browser.newContext();
  const page2 = await elsewhere.newPage();
  await page2.goto(link);
  await expect(page2).toHaveURL(/\/login\?link=failed/);
  await expect(page2.getByText("That sign-in link didn't work.")).toBeVisible();
  await elsewhere.close();
});
