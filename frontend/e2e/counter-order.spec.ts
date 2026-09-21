import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("manager records and completes a configured counter order", async ({ page }, testInfo) => {
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("manager@manager.com");
  await page.getByLabel("Password", { exact: true }).fill("Manager@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.goto("/staff/counter");
  await page.getByRole("button", { name: /^Add drink/ }).click();
  await expect(page.getByRole("button", { name: "Place counter order" })).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("counter-order.png"), fullPage: true });
  const response = page.waitForResponse((res) => res.url().endsWith("/counter-orders") && res.status() === 201);
  await page.getByRole("button", { name: "Place counter order" }).click();
  const order = await (await response).json();
  await expect(page.getByRole("heading", { name: `Counter order ${order.publicOrderNumber}` })).toBeVisible();
  await page.getByRole("link", { name: "Open order queue" }).click();
  await page.getByRole("button", { name: `View ${order.publicOrderNumber}` }).click();
  await page.getByRole("button", { name: "Collect cash & complete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /confirm/i }).click();
  await page.getByRole("combobox", { name: "Order status" }).click();
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await expect(page.getByRole("button", { name: `View ${order.publicOrderNumber}` })).toBeVisible();
  await expect(page.getByText("Paid · Completed").first()).toBeVisible();
});
