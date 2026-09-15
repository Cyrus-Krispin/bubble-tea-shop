import { expect, test } from "@playwright/test";

test("staff private content clears when an expired token cannot refresh", async ({ page }) => {
  await page.clock.install();
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("manager@manager.com");
  await page.getByLabel("Password", { exact: true }).fill("Manager@1234");
  const loginResponse = page.waitForResponse((response) => response.url().includes("grant_type=password") && response.status() === 200);
  await page.getByRole("button", { name: "Sign in" }).click();
  const { expires_in: lifetime } = await (await loginResponse).json();
  expect(lifetime).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.route("**/auth/v1/token?grant_type=refresh_token", (route) => route.abort());
  await page.clock.fastForward((lifetime + 1) * 1000);
  await expect(page).toHaveURL(/\/staff\/sign-in/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations overview" })).not.toBeVisible();
});
