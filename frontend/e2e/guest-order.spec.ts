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
  const locationTrigger = page.getByRole("button", { name: "Pickup at Orchard Central" });
  await expect(locationTrigger).toBeVisible();
  expect((await locationTrigger.boundingBox())?.height).toBeLessThanOrEqual(80);
  await locationTrigger.click();
  const locationPhotos = page.locator(".location-picker-panel .location-picker-photo");
  for (let index = 0; index < await locationPhotos.count(); index += 1) {
    await expect.poll(() => locationPhotos.nth(index).evaluate((image) => {
      const photo = image as HTMLImageElement;
      return photo.complete && photo.naturalWidth > 0 && getComputedStyle(photo).objectFit === "cover";
    })).toBe(true);
  }
  await page.getByRole("link", { name: /Tiong Bahru/ }).click();
  await expect(page).toHaveURL(/\/shop\/tiong-bahru$/);
  await expect(page.getByRole("button", { name: "Pickup at Tiong Bahru" })).toBeVisible();
  await expect.poll(() => page.getByRole("region", { name: "All drinks" }).locator('[data-slot="card"]').count()).toBeGreaterThanOrEqual(5);
  const photos = page.locator(".drink-art");
  for (let index = 0; index < await photos.count(); index += 1) {
    const photo = photos.nth(index);
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate((image) => {
      const loadedImage = image as HTMLImageElement;
      return loadedImage.complete
        && loadedImage.naturalWidth > 0
        && getComputedStyle(loadedImage).objectFit === "cover";
    })).toBe(true);
  }
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

test("guest menu keeps a compact responsive product grid", async ({ page }) => {
  const viewports = [
    { width: 320, height: 800, columns: 1 },
    { width: 768, height: 900, columns: 2 },
    { width: 1024, height: 900, columns: 3 },
    { width: 1280, height: 800, columns: 4 },
    { width: 1366, height: 768, columns: 4 },
    { width: 1440, height: 900, columns: 4 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const grid = page.getByRole("region", { name: "All drinks" });
    const cards = grid.locator('[data-slot="card"]');
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(5);

    const firstRow = await Promise.all(
      Array.from({ length: viewport.columns }, (_, index) => cards.nth(index).boundingBox()),
    );
    const firstY = firstRow[0]?.y ?? 0;
    for (const card of firstRow) {
      expect(Math.abs((card?.y ?? 0) - firstY)).toBeLessThan(2);
    }

    if (viewport.columns === 4) {
      const firstCard = firstRow[0];
      expect((firstCard?.y ?? 0) + (firstCard?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
    }
  }

  const images = page.getByRole("region", { name: "All drinks" }).locator(".drink-art");
  await expect(images.nth(3)).toHaveAttribute("loading", "eager");
  await expect(images.nth(3)).toHaveAttribute("fetchpriority", "high");
  await expect(images.nth(4)).toHaveAttribute("loading", "lazy");
  await expect(images.nth(4)).toHaveAttribute("fetchpriority", "auto");
  await expectProductionQuality(page);
});

test("customer controls make selected and actionable states visually explicit", async ({ page }) => {
  await page.goto("/account/access?mode=sign-in");

  const accessNavigation = page.getByRole("navigation", { name: "Account access options" });
  const signIn = accessNavigation.getByRole("link", { name: "Sign in" });
  const createAccount = accessNavigation.getByRole("link", { name: "Create account" });
  await expect(signIn).toHaveAttribute("aria-current", "page");
  await expect(signIn).toHaveAttribute("data-variant", "default");
  await expect(createAccount).toHaveAttribute("data-variant", "ghost");

  await page.goto("/");
  const customize = page.getByRole("link", { name: /Customize / }).first();
  await expect(customize).toHaveAttribute("data-variant", "default");
});

test("catalog artwork keeps a crop-safe landscape source ratio", async ({ page }) => {
  await page.goto("/");
  const artwork = page.locator(".drink-art");
  await expect.poll(() => artwork.count()).toBeGreaterThanOrEqual(5);
  await expect(artwork.first()).toHaveAttribute("src", /\.webp\?v=2$/);

  for (let index = 0; index < await artwork.count(); index += 1) {
    await expect.poll(() => artwork.nth(index).evaluate((image) => {
      const productImage = image as HTMLImageElement;
      return productImage.complete ? productImage.naturalWidth / productImage.naturalHeight : 0;
    })).toBeCloseTo(4 / 3, 2);
  }
});

test("customer sees an account-linked order across the personalized storefront and history", async ({
  page,
}, testInfo) => {
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

  const email = `history-${testInfo.project.name}-${Date.now()}@example.test`;
  const password = "local-history-test-password";
  await page.goto("/account/access?mode=create");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("No orders yet")).toBeVisible();
  await expectProductionQuality(page);

  await page.getByRole("link", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Drinks made your way" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order again" })).toHaveCount(0);
  await page.getByRole("link", { name: /Customize / }).first().click();
  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.getByRole("link", { name: "Menu", exact: true }).click();
  await page.getByRole("link", { name: /Customize / }).nth(1).click();
  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.getByRole("link", { name: "View order" }).click();
  await page.getByRole("button", { name: /Place order ·/ }).click();
  const confirmation = page.getByRole("heading", { name: /Pickup BT\d+/ });
  await expect(confirmation).toBeVisible();
  const publicOrderNumber = (await confirmation.textContent())?.replace("Pickup ", "") ?? "";

  await page.getByRole("link", { name: "Start another order" }).click();
  await expect(page.getByRole("heading", { name: "Order again" })).toBeVisible();
  const reorderCards = page.locator(".last-order-item");
  await expect(reorderCards).toHaveCount(2);
  const firstCard = await reorderCards.nth(0).boundingBox();
  const secondCard = await reorderCards.nth(1).boundingBox();
  expect(Math.abs((firstCard?.y ?? 0) - (secondCard?.y ?? 0))).toBeLessThan(2);
  const reorderArtwork = await reorderCards.nth(0).locator(".drink-art").boundingBox();
  const reorderRatio = (reorderArtwork?.width ?? 0) / (reorderArtwork?.height ?? 1);
  expect(Math.abs(reorderRatio - (4 / 3))).toBeLessThan(0.02);
  if (testInfo.project.name === "mobile-chromium") {
    await expect.poll(() => page.locator(".last-order__items").evaluate(
      (rail) => rail.scrollWidth > rail.clientWidth,
    )).toBe(true);
  }
  await page.getByRole("checkbox", { name: /Select 1 Moonlit Milk Tea/ }).uncheck();
  await page.getByRole("button", { name: /Add 1 drink ·/ }).click();
  await expect(page.getByText("Added 1 drink to your order.")).toBeVisible();
  await expectProductionQuality(page);

  await page.getByRole("link", { name: "Order 1 item" }).click();
  await expect(page.getByRole("heading", { name: "Your current order" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sunberry Oolong" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moonlit Milk Tea" })).toHaveCount(0);
  await page.getByRole("link", { name: "Account" }).click();
  await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible();
  const receiptLink = page.getByRole("link", { name: `View order ${publicOrderNumber}` });
  await expect(receiptLink).toBeVisible();
  await receiptLink.click();
  await expect(page.getByRole("heading", { name: `Order ${publicOrderNumber}` })).toBeVisible();
  await expect(page.getByText("This receipt preserves the names and prices from when you ordered.")).toBeVisible();
  await expectProductionQuality(page);

  await page.getByRole("link", { name: "Back to order history" }).click();
  await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible();
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
