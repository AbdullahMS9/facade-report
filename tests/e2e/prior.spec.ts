import { expect, test } from "@playwright/test";
import { deleteUserAndFirm, signInCode, testEmail } from "./support";

const email = testEmail("e2e-prior");
const SHOTS = process.env.E2E_SCREENSHOTS; // optional folder for screenshots

test.afterAll(async () => {
  await deleteUserAndFirm(email);
});

test("prior filings load from Open Data and prior SWARMP items carry forward", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByLabel("Sign-in code").fill(await signInCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Firm name").fill("Fictional Facade Engineers Prior");
  await page.getByRole("button", { name: "Create firm" }).click();

  await page.getByRole("link", { name: "New project" }).click();
  await page.getByLabel("Address").fill("77 Placeholder Place");
  await page.getByLabel("Borough").selectOption("bronx");
  await page.getByLabel("Block").fill("2345");
  await page.getByLabel("Lot").fill("12");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "77 Placeholder Place" })).toBeVisible();

  // Filings from the fake API (looked up by borough/block/lot: no BIN yet).
  await expect(page.getByText("Cycle 9: SWARMP")).toBeVisible();
  await expect(page.getByText("The last cycle was SWARMP.")).toBeVisible();
  await expect(page.getByText("SAM SAMPLE (RA - 000999)")).toBeVisible();
  await expect(page.getByText(/From NYC Open Data, updated/)).toBeVisible();

  // Refresh keeps working.
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Cycle 9: SWARMP")).toBeVisible();

  // List a prior SWARMP condition and say it wasn't repaired.
  await page.getByRole("link", { name: "Manage prior-cycle items" }).click();
  await page.getByLabel("Condition from the previous report").fill("Cracked brick at 6th floor pier, north elevation");
  await page.getByLabel("Location").fill("North elevation, floor 6");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Item 1: Not decided yet")).toBeVisible();

  const item = page.getByRole("group", { name: /Item 1/ });
  await item.getByLabel("Repaired?").selectOption("no");
  await item.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("Item 1: Not repaired: report as UNSAFE")).toBeVisible();

  await page.getByRole("link", { name: "← 77 Placeholder Place" }).click();
  await expect(page.getByText("1 not repaired, reported as UNSAFE")).toBeVisible();
  await expect(page.getByText("0 not decided yet")).toBeVisible();
  await expect(page.getByText("Cycle 9: SWARMP")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/11-prior.png`, fullPage: true });
});
