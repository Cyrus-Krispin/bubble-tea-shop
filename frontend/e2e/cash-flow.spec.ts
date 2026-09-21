import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("manager records and corrects a paid expense", async ({ page }, testInfo) => {
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("manager@manager.com");
  await page.getByLabel("Password", { exact: true }).fill("Manager@1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.goto("/staff/cash-flow");
  await expect(page.getByRole("heading", { name: "Money collected" })).toBeVisible();
  const description = `Browser expense ${Date.now()}`;
  await page.getByLabel("Expense description").fill(description);
  await page.getByLabel("Amount paid (SGD)").fill("12.34");
  const recorded = page.waitForResponse((response) => response.url().endsWith("/cash-flow/expenses") && response.status() === 201);
  await page.getByRole("button", { name: "Record expense", exact: true }).click();
  await recorded;
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Void ${description}`, exact: true }).click();
  await page.getByLabel("Reason for correction").fill("Browser verification correction");
  await page.getByRole("button", { name: "Confirm correction" }).click();
  await expect(page.getByText(description, { exact: true }).locator("..").getByText(/Voided/)).toBeVisible();
  await page.getByRole("combobox", { name: "Reporting period" }).click();
  await page.getByRole("option", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Money collected" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("cash-flow.png"), fullPage: true });
});
