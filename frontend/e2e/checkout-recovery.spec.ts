import { expect, test } from "@playwright/test";

test("guest recovers one real order after a lost response and route navigation", async ({ page }) => {
  await page.goto("/shop/orchard-central");
  await page.getByRole("link", { name: /Customize Moonlit Milk Tea/ }).click();
  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.getByRole("link", { name: "View order" }).click();
  let firstOrderId = "";
  const keys: string[] = [];
  await page.route("**/api/v1/guest/locations/*/orders", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      firstOrderId = (await response.json()).id;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: /Place order ·/ }).click();
  await expect(page.getByText(/We couldn’t confirm/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Increase Moonlit Milk Tea quantity" })).toBeDisabled();
  await page.getByRole("link", { name: "Back to menu" }).click();
  await page.getByRole("link", { name: /Customize Moonlit Milk Tea/ }).click();
  await expect(page.getByRole("button", { name: /Add to order/ })).toBeDisabled();
  await page.getByRole("link", { name: "Recover your order" }).click();
  const replay = page.waitForResponse((response) => response.url().endsWith("/orders") && response.request().method() === "POST" && response.status() === 200);
  await page.getByRole("button", { name: /Place order ·/ }).click();
  expect((await (await replay).json()).id).toBe(firstOrderId);
  await expect(page.getByRole("heading", { name: /Pickup BT/ })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});
