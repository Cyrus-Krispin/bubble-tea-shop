import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("manager reads scoped inventory forecasts", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("manager@manager.com");
  await page.getByLabel("Password", { exact: true }).fill("Manager@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.goto("/staff/inventory");
  const response = page.waitForResponse((res) => res.url().includes("/inventory/forecasts") && res.status() === 200);
  await page.getByRole("button", { name: "Show consumption forecasts" }).click();
  const payload = await (await response).json();
  expect(payload.items.length).toBeGreaterThan(0);
  await expect(page.getByRole("columnheader", { name: "Estimated stock remaining" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh forecasts" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("inventory-forecast.png"), fullPage: true });
});
