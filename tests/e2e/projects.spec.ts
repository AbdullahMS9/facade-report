import { expect, test, type Page } from "@playwright/test";
import { deleteUserAndFirm, signInCode, testEmail } from "./support";

const SHOTS = process.env.E2E_SCREENSHOTS; // optional folder for screenshots

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const email = testEmail("e2e-qewi");

test.afterAll(async () => {
  await deleteUserAndFirm(email);
});

test("sign in, set up a firm, create a project and edit the building", async ({ page }) => {
  // Signed-out visitors land on sign-in.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We sent a 6-digit code to ${email}`)).toBeVisible();
  await shot(page, "01-code");
  await page.getByLabel("Sign-in code").fill(await signInCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();

  // New user → create firm.
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Firm name").fill("Fictional Facade Engineers E2E");
  await page.getByRole("button", { name: "Create firm" }).click();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByText("No projects yet")).toBeVisible();
  await shot(page, "02-empty-list");

  // New project with a new building.
  await page.getByRole("link", { name: "New project" }).click();
  await page.getByLabel("Address").fill("123 Example Street");
  await page.getByLabel("Borough").selectOption("manhattan");
  await page.getByLabel("Block").fill("1234");
  await page.getByLabel("Lot").fill("5");
  await shot(page, "03-new-project");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "123 Example Street" })).toBeVisible();
  await shot(page, "04-overview");

  // Edit the building: a bad value shows an error and keeps what was typed.
  await page.getByRole("link", { name: "Edit building" }).click();
  await page.getByLabel("Stories").fill("twelve");
  await page.getByLabel("Owner name").fill("Example Holdings LLC");
  await page.getByRole("button", { name: "Save building" }).click();
  await expect(page.getByText("Stories must be a whole number.")).toBeVisible();
  await expect(page.getByLabel("Owner name")).toHaveValue("Example Holdings LLC");

  // Fix it; a BIN from another borough saves with a warning.
  await page.getByLabel("Stories").fill("12");
  await page.getByLabel("BIN").fill("3000001");
  await page.getByLabel("Exterior wall materials").fill("Brick, terra cotta");
  await page.getByLabel("Cavity wall?").selectOption("yes");
  await page.getByRole("button", { name: "Save building" }).click();
  await expect(page.getByText(/Saved\. BIN 3000001 starts with 3, but Manhattan BINs start with 1/)).toBeVisible();
  await shot(page, "05-building-saved");

  // The overview and the list reflect the changes.
  await page.getByRole("link", { name: "← 123 Example Street" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.getByText("Brick, terra cotta", { exact: true })).toBeVisible();
  await expect(page.getByText("Example Holdings LLC", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← Projects" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Block 1234 ends in 4 → Cycle 10 window closes Feb 21, 2027.
  await expect(page.getByText("Due Feb 21, 2027")).toBeVisible();
  await shot(page, "06-list");

  // Add an inspector on the team page.
  await page.getByRole("link", { name: "Team" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Pat Example");
  await page.getByLabel("License number").fill("000123");
  await page.getByRole("button", { name: "Add inspector" }).click();
  await expect(page.getByText("PE 000123")).toBeVisible();

  // Project details: QEWI and a final inspection date move the deadline.
  await page.getByRole("link", { name: "← Fictional Facade Engineers E2E" }).click();
  await page.getByRole("link", { name: /123 Example Street/ }).click();
  await page.getByRole("link", { name: "Edit project" }).click();
  await expect(page.getByRole("heading", { name: "Project details" })).toBeVisible();
  await page.getByLabel("QEWI", { exact: true }).selectOption({ label: "Pat Example (PE 000123)" });
  await page.getByLabel("Exam start").fill("2026-09-20");
  await page.getByLabel("Exam end").fill("2026-09-10");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Exam end date can't be before the start date.")).toBeVisible();
  await page.getByLabel("Exam end").fill("2026-10-01");
  await page.getByLabel("QEWI final inspection").fill("2026-10-01");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await shot(page, "07-details");

  await page.getByRole("link", { name: "← 123 Example Street" }).click();
  await expect(page.getByText("Deadline Nov 30, 2026")).toBeVisible();
  await expect(page.getByText("Set by: 60 days after the final inspection.")).toBeVisible();
  await expect(page.getByText("Pat Example (PE 000123)")).toBeVisible();

  // "Ready to file" is refused while the checker has blockers.
  await page.getByLabel("Status", { exact: true }).selectOption("ready");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText(/Fix the \d+ checker blockers first/)).toBeVisible();
  await expect(page.getByText(/^Checker: \d+ blockers/)).toBeVisible();
  await shot(page, "08-overview-full");

  // Elevations: a 75 ft street elevation needs 2 drops.
  await page.getByRole("link", { name: "Add elevation" }).click();
  await page.getByLabel("Name", { exact: true }).fill("North (Example Street)");
  await page.getByLabel("Faces a street?").selectOption("yes");
  await page.getByLabel("Frontage (ft)").fill("75");
  await page.getByRole("button", { name: "Add elevation" }).click();
  await expect(page.getByRole("heading", { name: "North (Example Street)" })).toBeVisible();
  await expect(page.getByText("0 of 2 required drops recorded (2 more needed).")).toBeVisible();

  // Record a drop.
  await page.getByLabel("Location", { exact: true }).fill("Bay 1, west of entrance");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-21");
  await page.getByLabel("Method").selectOption("scaffold");
  await page.getByRole("button", { name: "Add drop" }).click();
  await expect(page.getByText("1 of 2 required drops recorded (1 more needed).")).toBeVisible();
  await expect(page.getByText("Drop 1: Bay 1, west of entrance")).toBeVisible();
  // Cavity wall = yes, so each drop asks for a probe.
  await expect(page.getByText("No probe yet.", { exact: false })).toBeVisible();

  // Add a probe, then delete it (QEWI only, with confirmation).
  await page.getByText("Add probe", { exact: true }).first().click();
  await page.getByLabel("Probe location").fill("Floor 4, left pier");
  await page.getByLabel("Tie type").fill("Corrugated metal");
  await page.getByRole("button", { name: "Add probe" }).click();
  await expect(page.getByText("Tie type: Corrugated metal")).toBeVisible();
  await shot(page, "09-elevation");
  await page.getByText("Delete probe").click();
  await page.getByRole("button", { name: "Yes, delete" }).first().click();
  await expect(page.getByText("Tie type: Corrugated metal")).toHaveCount(0);

  // Overview shows the elevation's progress and the building minimum.
  await page.getByRole("link", { name: "← 123 Example Street" }).click();
  await expect(page.getByText("1 of 2 drops · 0 probes")).toBeVisible();
  await expect(page.getByText("Building: 1 drop recorded, at least 2 required.")).toBeVisible();
  await shot(page, "10-overview-elevations");
});
