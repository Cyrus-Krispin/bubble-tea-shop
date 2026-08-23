import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const MAX_DOM_CONTENT_LOADED_MS = 5_000;
const MAX_JAVASCRIPT_TRANSFER_BYTES = 200 * 1024;

async function expectProductionQuality(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations, JSON.stringify(accessibility.violations, null, 2)).toEqual([]);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
}

test("guest can place a cash order on the production stack", async ({ page }) => {
  const consoleProblems: string[] = [];
  const apiFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400) {
      apiFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Drinks made your way" })).toBeVisible();
  await expectProductionQuality(page);

  await page.getByRole("link", { name: /Customize / }).first().click();
  await expect(page.getByRole("heading", { name: "Customize your drink" })).toBeVisible();
  await expectProductionQuality(page);

  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.getByRole("link", { name: "View order" }).click();
  await expect(page.getByRole("heading", { name: "Your current order" })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expectProductionQuality(page);

  await page.getByRole("button", { name: /Place order ·/ }).click();
  await expect(page.getByRole("heading", { name: /Pickup BT\d+/ })).toBeVisible();
  await expectProductionQuality(page);

  expect(apiFailures).toEqual([]);
  expect(consoleProblems).toEqual([]);
});

test("production entrypoint stays within its transfer and load budgets", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Drinks made your way" })).toBeVisible();

  const budgets = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const javascriptTransferBytes = performance.getEntriesByType("resource")
      .filter((entry) => entry.name.endsWith(".js"))
      .reduce((total, entry) => total + (entry as PerformanceResourceTiming).transferSize, 0);
    return {
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      javascriptTransferBytes,
    };
  });

  expect(budgets.domContentLoadedMs).toBeLessThanOrEqual(MAX_DOM_CONTENT_LOADED_MS);
  expect(budgets.javascriptTransferBytes).toBeGreaterThan(0);
  expect(budgets.javascriptTransferBytes).toBeLessThanOrEqual(MAX_JAVASCRIPT_TRANSFER_BYTES);
});
