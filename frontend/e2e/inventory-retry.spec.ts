import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await expect(page.getByRole("link", { name: "Bubble Tea Shop staff home" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Open staff navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name, exact: true }).click();
}

test("one real stock receipt survives a lost response and navigation", async ({ page }, testInfo) => {
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("manager@manager.com");
  await page.getByLabel("Password", { exact: true }).fill("Manager@1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await navigate(page, "Inventory");
  await page.getByRole("combobox", { name: "Location", exact: true }).click();
  await page.getByRole("option", { name: "Orchard Central", exact: true }).click();
  const row = page.getByRole("row").filter({ has: page.getByText("Black Tea", { exact: true }) }).first();
  await expect(row).toBeVisible();
  const reference = `Retry verification ${Date.now()}`;
  await row.getByRole("button", { name: "Record", exact: true }).click();
  await page.getByRole("combobox", { name: "Movement type" }).click();
  await page.getByRole("option", { name: "Receipt", exact: true }).click();
  await page.getByLabel("Quantity (g)").fill("1");
  await page.getByLabel("Source reference").fill(reference);
  let originalId = "";
  const keys: string[] = [];
  await page.route("**/inventory/movements", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) {
      const committed = await route.fetch();
      expect(committed.status()).toBe(201);
      originalId = (await committed.json()).id;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Record movement", exact: true }).click();
  await expect(page.getByText(/The outcome is unknown/)).toBeVisible();
  await expect(page.getByLabel("Quantity (g)")).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Close dialog", exact: true }).click();
  await navigate(page, "Overview");
  await navigate(page, "Inventory");
  await page.getByRole("button", { name: "Resume stock movement" }).click();
  await expect(page.getByLabel("Quantity (g)")).toHaveValue("1");
  const replay = page.waitForResponse((response) => response.url().endsWith("/inventory/movements") && response.request().method() === "POST" && response.status() === 201);
  await page.getByRole("button", { name: "Retry same movement" }).click();
  expect((await (await replay).json()).id).toBe(originalId);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText(reference, { exact: true })).toHaveCount(1);
  expect(keys).toHaveLength(2); expect(keys[1]).toBe(keys[0]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("inventory-recovery.png"), fullPage: true });
  // Preserve the verification audit while restoring the physical count.
  await row.getByRole("button", { name: "Record", exact: true }).click();
  await page.getByRole("combobox", { name: "Movement type" }).click();
  await page.getByRole("option", { name: "Adjustment", exact: true }).click();
  await page.getByLabel("Quantity (g)").fill("-1");
  await page.getByLabel("Adjustment reason").fill(`Restore count after ${reference}`);
  await page.getByRole("button", { name: "Record movement", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
