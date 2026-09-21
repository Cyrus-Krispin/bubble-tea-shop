import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("guest and counter staff can clear an optional single topping", async ({ page }, testInfo) => {
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("owner@owner.com");
  await page.getByLabel("Password", { exact: true }).fill("Owner@1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.goto("/staff/catalog/options");
  await page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Toppings", exact: true }) }).getByRole("link", { name: "Open group" }).click();
  const groupUrl = page.url();
  await page.getByRole("button", { name: "Edit group", exact: true }).click();
  const originalMax = await page.getByLabel("Maximum", { exact: true }).inputValue();
  await page.getByLabel("Maximum", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  try {
    await page.goto("/shop/orchard-central/drinks/moonlit-milk-tea");
    await expect(page.getByRole("radio", { name: "None for Toppings" })).toBeChecked();
    await page.getByRole("radio", { name: /Pearls/ }).check();
    await expect(page.getByRole("button", { name: /Add to order/ })).toContainText("7.20");
    await page.getByRole("radio", { name: "None for Toppings" }).check();
    await expect(page.getByRole("button", { name: /Add to order/ })).toContainText("6.60");
    await expect(page.getByRole("radio", { name: "None for Sweetness" })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("optional-customer-choice.png"), fullPage: true });
    await page.goto("/staff/counter");
    await page.getByRole("combobox", { name: "Shop", exact: true }).click();
    await page.getByRole("option", { name: "Orchard Central", exact: true }).click();
    await page.getByRole("combobox", { name: "Drink", exact: true }).click();
    await page.getByRole("option", { name: "Moonlit Milk Tea", exact: true }).click();
    await page.getByRole("radio", { name: /Pearls/ }).check();
    await expect(page.getByRole("button", { name: /Add drink/ })).toContainText("7.20");
    await page.getByRole("radio", { name: "None for Toppings" }).check();
    await expect(page.getByRole("button", { name: /Add drink/ })).toContainText("6.60");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  } finally {
    await page.goto(groupUrl);
    await page.getByRole("button", { name: "Edit group", exact: true }).click();
    await page.getByLabel("Maximum", { exact: true }).fill(originalMax);
    await page.getByRole("button", { name: "Save group", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});
