import { expect, test, type Page } from "@playwright/test";
import { deleteUserAndFirm, signInCode, testEmail, withExifDate } from "./support";

const email = testEmail("e2e-checker");
const SHOTS = process.env.E2E_SCREENSHOTS;

test.afterAll(async () => {
  await deleteUserAndFirm(email);
});

// Dates relative to today (New York), so the test doesn't go stale.
function isoDaysFromToday(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const exifDate = (iso: string) => `${iso.replaceAll("-", ":")} 10:00:00`;

async function makeJpeg(page: Page, label: string): Promise<Buffer> {
  const base64 = await page.evaluate((label) => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 900;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#6b8e23";
    ctx.fillRect(0, 0, 1200, 900);
    ctx.fillStyle = "#fff";
    ctx.font = "48px sans-serif";
    ctx.fillText(label, 40, 80);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1]!;
  }, label);
  return Buffer.from(base64, "base64");
}

test("fix every checker blocker, then mark the report ready to file", async ({ page }) => {
  const finalInspection = isoDaysFromToday(-5);
  const closeupsDone = isoDaysFromToday(-10);
  const examStart = isoDaysFromToday(-30);
  const repairBy = isoDaysFromToday(-5 + 730); // ~2 years after the final inspection: fits SWARMP

  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByLabel("Sign-in code").fill(await signInCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Firm name").fill("Fictional Facade Engineers Checker");
  await page.getByRole("button", { name: "Create firm" }).click();

  // An inspector to name as QEWI.
  await page.getByRole("link", { name: "Team" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Pat Example");
  await page.getByLabel("License number").fill("000777");
  await page.getByRole("button", { name: "Add inspector" }).click();
  await expect(page.getByText("PE 000777")).toBeVisible();

  // A bare project: lots of blockers.
  await page.goto("/projects/new");
  await page.getByLabel("Address").fill("55 Checker Street");
  await page.getByLabel("Borough").selectOption("manhattan");
  await page.getByLabel("Block").fill("1234");
  await page.getByLabel("Lot").fill("5");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "55 Checker Street" })).toBeVisible();
  const projectUrl = page.url();
  await expect(page.getByRole("link", { name: /^Checker: \d+ blockers/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before filing" })).toBeVisible();

  // "Ready to file" is refused now.
  await page.getByLabel("Status", { exact: true }).selectOption("ready");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText(/Fix the \d+ checker blockers first/)).toBeVisible();

  // The checker page lists what's wrong with links to fix it.
  await page.getByRole("link", { name: /^Checker:/ }).click();
  await expect(page.getByRole("heading", { name: "Checker", exact: true })).toBeVisible();
  await expect(page.getByText("Missing: BIN.")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/15-checker-before.png`, fullPage: true });

  // Building: BIN, materials, cavity wall, owner.
  await page.goto(`${projectUrl}/building`);
  await page.getByLabel("BIN").fill("1000123");
  await page.getByLabel("Exterior wall materials").fill("Brick, cast stone");
  await page.getByLabel("Cavity wall?").selectOption("no");
  await page.getByLabel("Owner name").fill("Example Holdings LLC");
  await page.getByLabel("Mailing address").fill("1 Sample Plaza, New York, NY");
  await page.getByRole("button", { name: "Save building" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Project details: QEWI and dates.
  await page.goto(`${projectUrl}/details`);
  await page.getByLabel("QEWI", { exact: true }).selectOption({ label: "Pat Example (PE 000777)" });
  await page.getByLabel("Exam start").fill(examStart);
  await page.getByLabel("Exam end").fill(finalInspection);
  await page.getByLabel("Close-up inspections completed").fill(closeupsDone);
  await page.getByLabel("QEWI final inspection").fill(finalInspection);
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // One 50 ft street elevation with its one required drop.
  await page.goto(`${projectUrl}/elevations/new`);
  await page.getByLabel("Name", { exact: true }).fill("North");
  await page.getByLabel("Faces a street?").selectOption("yes");
  await page.getByLabel("Frontage (ft)").fill("50");
  await page.getByRole("button", { name: "Add elevation" }).click();
  await page.getByLabel("Location", { exact: true }).fill("Bay 1");
  await page.getByLabel("Date", { exact: true }).fill(closeupsDone);
  await page.getByLabel("Method").selectOption("scaffold");
  await page.getByRole("button", { name: "Add drop" }).click();
  await expect(page.getByText("1 of 1 required drops recorded.")).toBeVisible();

  // A SWARMP observation with photo, cause, repair and a date inside the limits.
  await page.goto(`${projectUrl}/observations/new`);
  await page.locator("#capture-library").setInputFiles({
    name: "crack.jpg",
    mimeType: "image/jpeg",
    buffer: withExifDate(await makeJpeg(page, "Crack"), exifDate(closeupsDone)),
  });
  await expect(page.getByRole("img", { name: "Selected photo" })).toBeVisible();
  await page.getByText("SWARMP", { exact: true }).click();
  await page.getByLabel("Elevation", { exact: true }).selectOption({ label: "North" });
  await page.getByLabel("Element").fill("Brick masonry");
  await page.getByLabel("Condition", { exact: true }).fill("Cracked brick at 3rd floor pier");
  await page.getByLabel("Cause").fill("Water infiltration and freeze-thaw");
  await page.getByLabel("Recommended repair").fill("Replace cracked brick and repoint");
  await page.getByLabel("Repair by").fill(repairBy);
  await page.getByRole("button", { name: "Save observation" }).click();
  await expect(page.getByRole("heading", { name: "Brick masonry" })).toBeVisible();

  // Inspector-at-work and elevation photos.
  await page.goto(`${projectUrl}/photos`);
  await page.locator("#photos-inspector-project-library").setInputFiles({
    name: "inspector.jpg",
    mimeType: "image/jpeg",
    buffer: withExifDate(await makeJpeg(page, "Inspector"), exifDate(closeupsDone)),
  });
  await expect(page.getByText("Inspector at work (1)")).toBeVisible();
  await page.locator("#photos-elevation-project-library").setInputFiles({
    name: "elevation.jpg",
    mimeType: "image/jpeg",
    buffer: withExifDate(await makeJpeg(page, "North elevation"), exifDate(closeupsDone)),
  });
  await expect(page.getByText("Elevation (1)")).toBeVisible();

  // All clear: no blockers, no warnings.
  await page.goto(projectUrl);
  await expect(page.getByRole("link", { name: "Checker: ready to file" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before filing" })).toHaveCount(0);
  await page.getByLabel("Status", { exact: true }).selectOption("ready");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Status updated.")).toBeVisible();
  await expect(page.getByText("Ready to file").first()).toBeVisible();
  if (SHOTS) {
    await page.goto(`${projectUrl}/checker`);
    await page.screenshot({ path: `${SHOTS}/16-checker-after.png`, fullPage: true });
  }
});
