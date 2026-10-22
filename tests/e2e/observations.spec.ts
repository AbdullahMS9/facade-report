import { expect, test, type Page } from "@playwright/test";
import { deleteUserAndFirm, firmIdFor, listFirmFiles, signInCode, testEmail, withExifDate } from "./support";

const email = testEmail("e2e-obs");
const SHOTS = process.env.E2E_SCREENSHOTS;

test.afterAll(async () => {
  await deleteUserAndFirm(email);
});

// Draws a fictional test image in the browser and returns JPEG bytes.
async function makeJpeg(page: Page, width: number, height: number, label: string): Promise<Buffer> {
  const base64 = await page.evaluate(
    ({ width, height, label }) => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, "#b5651d");
      g.addColorStop(1, "#4a6fa5");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#fff";
      ctx.font = "48px sans-serif";
      ctx.fillText(label, 40, 80);
      return c.toDataURL("image/jpeg", 0.9).split(",")[1]!;
    },
    { width, height, label },
  );
  return Buffer.from(base64, "base64");
}

test("record an observation with photos, check warnings, and delete it", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByLabel("Sign-in code").fill(await signInCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Firm name").fill("Fictional Facade Engineers Obs");
  await page.getByRole("button", { name: "Create firm" }).click();

  await page.getByRole("link", { name: "New project" }).click();
  await page.getByLabel("Address").fill("88 Example Street");
  await page.getByLabel("Borough").selectOption("brooklyn");
  await page.getByLabel("Block").fill("1004");
  await page.getByLabel("Lot").fill("20");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "88 Example Street" })).toBeVisible();
  const projectUrl = page.url();

  // Final inspection date (repair limits are measured from it) and one elevation.
  await page.getByRole("link", { name: "Edit project" }).click();
  await page.getByLabel("QEWI final inspection").fill("2026-10-01");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto(projectUrl);
  await page.getByRole("link", { name: "Add elevation" }).click();
  await page.getByLabel("Name", { exact: true }).fill("North");
  await page.getByLabel("Faces a street?").selectOption("yes");
  await page.getByLabel("Frontage (ft)").fill("75");
  await page.getByRole("button", { name: "Add elevation" }).click();
  await expect(page.getByRole("heading", { name: "North" })).toBeVisible();

  // New observation: one good photo with a camera date, one too small without.
  await page.goto(projectUrl);
  await page.getByRole("link", { name: "New observation" }).click();
  const big = withExifDate(await makeJpeg(page, 1600, 1200, "Parapet"), "2026:09:21 10:30:00");
  const small = await makeJpeg(page, 600, 400, "Small");
  await page.locator("#capture-library").setInputFiles([
    { name: "parapet.jpg", mimeType: "image/jpeg", buffer: big },
    { name: "small.jpg", mimeType: "image/jpeg", buffer: small },
  ]);
  await expect(page.getByText("Only 600 × 400 px. FISP photos must be at least 800 × 600.")).toBeVisible();
  await expect(page.getByText("No camera date found; used the file date. Check it.")).toHaveCount(1);
  // Drop the small one.
  await page.getByRole("button", { name: "Remove" }).nth(1).click();
  await expect(page.getByText(/Only 600 × 400/)).toHaveCount(0);

  await page.getByText("UNSAFE", { exact: true }).click();
  await page.getByLabel("Elevation", { exact: true }).selectOption({ label: "North" });
  await page.getByLabel("Floor").fill("Roof");
  await page.getByLabel("Element").fill("Parapet");
  await page.getByLabel("Condition", { exact: true }).fill("Loose coping stones along the street side");
  await page.getByLabel("Repair by").fill("2028-01-01");
  await expect(page.getByText(/UNSAFE repairs must be done within 1 year/)).toBeVisible();
  await page.getByLabel("Repair by").fill("2027-06-01");
  await expect(page.getByText(/UNSAFE repairs must be done within 1 year/)).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/12-new-observation.png`, fullPage: true });
  await page.getByRole("button", { name: "Save observation" }).click();

  // Observation page: the photo shows (signed URL works) with the camera date.
  await expect(page.getByRole("heading", { name: "Parapet" })).toBeVisible();
  await expect(page.getByText("Photos (1)")).toBeVisible();
  await expect(page.getByText("Sep 21, 2026, 10:30 AM")).toBeVisible();
  const img = page.getByRole("img", { name: /Photo taken/ });
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1600);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/13-observation.png`, fullPage: true });

  // List and filters.
  await page.getByRole("link", { name: "← Observations" }).click();
  await expect(page.getByRole("link", { name: "UNSAFE (1)" })).toBeVisible();
  await page.getByRole("link", { name: "SAFE (0)", exact: true }).click();
  await expect(page.getByText("No observations classified SAFE yet.")).toBeVisible();

  // Overview: building status follows the worst condition.
  await page.goto(projectUrl);
  await expect(page.getByText("1 observation: 1 UNSAFE, 0 SWARMP, 0 SAFE")).toBeVisible();
  await expect(page.getByText("Building status").locator("..").getByText("UNSAFE")).toBeVisible();

  // A typical-condition photo on the project photos page.
  await page.getByRole("link", { name: /Project photos/ }).click();
  await page.locator("#photos-typical-project-library").setInputFiles({
    name: "typical.jpg",
    mimeType: "image/jpeg",
    buffer: await makeJpeg(page, 1200, 900, "Typical"),
  });
  await expect(page.getByText("Added typical.jpg")).toBeVisible();
  await expect(page.getByText("Typical condition (1)")).toBeVisible();

  // Deleting the observation removes its two files from storage.
  const firmId = await firmIdFor(email);
  expect(await listFirmFiles(firmId)).toHaveLength(4); // 2 photos × (original + display)
  await page.goto(projectUrl);
  await page.getByRole("link", { name: "All observations" }).click();
  await page.getByRole("link", { name: /Parapet/ }).click();
  await page.getByText("Delete observation").click();
  await page.getByRole("button", { name: "Yes, delete" }).last().click();
  await expect(page.getByRole("heading", { name: "Observations" })).toBeVisible();
  await expect(page.getByText("No observations yet.")).toBeVisible();
  expect(await listFirmFiles(firmId)).toHaveLength(2);
});
