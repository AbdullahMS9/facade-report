import { expect, test, type Page } from "@playwright/test";
import { deleteUserAndFirm, signInCode, testEmail } from "./support";

const email = testEmail("e2e-offline");
const SHOTS = process.env.E2E_SCREENSHOTS;

test.afterAll(async () => {
  await deleteUserAndFirm(email);
});

async function makeJpeg(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    ({ width, height }) => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(0, 0, width, height);
      return c.toDataURL("image/jpeg", 0.9).split(",")[1]!;
    },
    { width, height },
  );
  return Buffer.from(base64, "base64");
}

test("capture an observation offline in field mode, then sync it", async ({ page, context }) => {
  // Online: sign in, create a project with an elevation, open its overview.
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByLabel("Sign-in code").fill(await signInCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Firm name").fill("Fictional Facade Engineers Offline");
  await page.getByRole("button", { name: "Create firm" }).click();
  await page.getByRole("link", { name: "New project" }).click();
  await page.getByLabel("Address").fill("99 Offline Avenue");
  await page.getByLabel("Borough").selectOption("manhattan");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "99 Offline Avenue" })).toBeVisible();
  const projectUrl = page.url();
  const projectId = projectUrl.split("/").pop()!;
  await page.getByRole("link", { name: "Add elevation" }).click();
  await page.getByLabel("Name", { exact: true }).fill("West");
  await page.getByLabel("Faces a street?").selectOption("yes");
  await page.getByLabel("Frontage (ft)").fill("40");
  await page.getByRole("button", { name: "Add elevation" }).click();
  await expect(page.getByRole("heading", { name: "West" })).toBeVisible();
  await page.goto(projectUrl);
  await expect(page.getByText("Saved on this phone for offline capture.")).toBeVisible();

  // The service worker has saved field mode.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await caches.match("/field", { ignoreSearch: true }))), { timeout: 30_000 })
    .toBe(true);

  // Offline: open field mode for the project and capture an observation.
  await context.setOffline(true);
  await page.goto(`/field?project=${projectId}`);
  await expect(page.getByText("Offline. Observations are saved on this phone")).toBeVisible();
  await expect(page.getByRole("heading", { name: "99 Offline Avenue" })).toBeVisible();

  await page.locator("#capture-library").setInputFiles({
    name: "crack.jpg",
    mimeType: "image/jpeg",
    buffer: await makeJpeg(page, 1600, 1200),
  });
  await expect(page.getByRole("img", { name: "Selected photo" })).toBeVisible();
  await page.getByText("SWARMP", { exact: true }).click();
  await page.getByLabel("Elevation", { exact: true }).selectOption({ label: "West" });
  await page.getByLabel("Element").fill("Brick masonry");
  await page.getByLabel("Condition", { exact: true }).fill("Step cracking below 4th floor window");
  await page.getByRole("button", { name: "Save observation" }).click();
  await expect(page.getByText("Saved on this phone. It will sync when there's a connection.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting to sync (2)" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/14-field-offline.png`, fullPage: true });

  // Still there after reloading with no signal.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Waiting to sync (2)" })).toBeVisible();
  await expect(page.getByText("SWARMP · Brick masonry")).toBeVisible();

  // Back online: it syncs on its own.
  await context.setOffline(false);
  await expect(page.getByText("Nothing waiting to sync.")).toBeVisible({ timeout: 45_000 });

  // The server has the observation and its photo.
  await page.goto(`${projectUrl}/observations`);
  await page.getByRole("link", { name: /Brick masonry/ }).click();
  await expect(page.getByText("Photos (1)")).toBeVisible();
  await expect(page.getByLabel("Condition", { exact: true })).toHaveValue("Step cracking below 4th floor window");
  const img = page.getByRole("img", { name: /Photo taken/ });
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1600);
});
