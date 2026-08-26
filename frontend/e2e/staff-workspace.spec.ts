import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("owner can navigate the responsive dark staff workspace", async ({ page }, testInfo) => {
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("owner@owner.com");
  await page.getByLabel("Password", { exact: true }).fill("Owner@1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("body *")]
    .every((element) => {
      const background = getComputedStyle(element).backgroundColor;
      return background !== "rgb(255, 255, 255)" && background !== "rgb(251, 250, 252)";
    }))).toBe(true);

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open staff navigation" }).click();
    const navigation = page.getByRole("navigation", { name: "Mobile staff navigation" });
    const overviewLink = navigation.getByRole("link", { name: "Overview" });
    const catalogLink = navigation.getByRole("link", { name: "Catalog" });
    await expect(overviewLink).toHaveAttribute("aria-current", "page");
    await expect(catalogLink).not.toHaveAttribute("aria-current", "page");
    expect(await overviewLink.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toBe(await catalogLink.evaluate((element) => getComputedStyle(element).backgroundColor));
    await expect(navigation.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Audit" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Team" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await catalogLink.click();
  } else {
    await page.getByRole("navigation", { name: "Staff navigation" }).getByRole("link", { name: "Catalog" }).click();
  }

  await expect(page).toHaveURL(/\/staff\/catalog\/ingredients$/);
  await expect(page.getByRole("heading", { name: "Ingredients", exact: true })).toBeVisible();
  const organizationPicker = page.getByRole("combobox", { name: "Organization" });
  await expect(organizationPicker).toHaveAttribute("data-slot", "select-trigger");
  await organizationPicker.click();
  await expect(page.getByRole("option").first()).toHaveAttribute("data-slot", "select-item");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open staff navigation" }).click();
    await page.getByRole("navigation", { name: "Mobile staff navigation" }).getByRole("link", { name: "Orders" }).click();
  } else {
    await page.getByRole("navigation", { name: "Staff navigation" }).getByRole("link", { name: "Orders" }).click();
  }

  await expect(page).toHaveURL(/\/staff\/orders$/);
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
