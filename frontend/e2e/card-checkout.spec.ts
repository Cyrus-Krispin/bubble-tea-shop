import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("disabled online payments retain real guest cash checkout", async ({ page }) => {
  await page.goto("/shop/orchard-central");
  await page.getByRole("link", { name: /Customize Moonlit Milk Tea/ }).click();
  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.getByRole("link", { name: "View order" }).click();
  await expect(page.getByText("Online card payments are not currently enabled.")).toBeVisible();
  await page.getByRole("button", { name: /Place order ·/ }).click();
  await expect(page.getByRole("heading", { name: /Pickup BT/ })).toBeVisible();
});

// UI boundary test only. Payment/stock persistence is verified independently against PostgreSQL.
test("card recovery survives a lost response and reload before showing a verified receipt", async ({ page }) => {
  const id = "90000000-0000-0000-0000-000000000001";
  const keys: string[] = [];
  let paid = false;
  const receipt = () => ({ id, state: paid ? "PAID" : "OPEN", checkoutUrl: paid ? null : "https://checkout.stripe.com/c/pay/test",
    expiresAt: "2030-01-01T00:00:00Z", cancellationRequested: false, recoveryCode: null, refundedMinor: 0,
    order: { id: "80000000-0000-0000-0000-000000000001", publicOrderNumber: "BT-CARD-TEST", status: "PENDING", paymentMethod: "CARD", currencyCode: "SGD",
      subtotalMinor: 660, totalMinor: 660, createdAt: "2026-09-15T00:00:00Z", replayed: true,
      items: [{ productName: "Test tea", variantName: "Medium", quantity: 1, unitPriceMinor: 660, lineTotalMinor: 660, options: [] }] } });
  await page.route("**/api/v1/guest/payment-methods", (route) => route.fulfill({ json: { cash: true, card: true } }));
  await page.route("**/api/v1/guest/locations/*/card-checkouts", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) await route.abort("failed");
    else await route.fulfill({ json: receipt() });
  });
  await page.route(`**/api/v1/guest/card-checkouts/${id}/refresh`, (route) => route.fulfill({ json: receipt() }));
  await page.goto("/shop/orchard-central");
  await page.getByRole("link", { name: /Customize Moonlit Milk Tea/ }).click();
  await page.getByRole("button", { name: /Add to order/ }).click();
  await page.getByRole("link", { name: "View order" }).click();
  await page.getByRole("combobox", { name: "Payment method" }).click();
  await page.getByRole("option", { name: "Online card payment" }).click();
  await page.getByRole("button", { name: /Continue to card payment/ }).click();
  await expect(page.getByRole("heading", { name: "Recover your card checkout" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("We couldn’t confirm");
  await page.reload();
  await page.getByRole("button", { name: "Retry same card checkout" }).click();
  await expect(page.getByRole("link", { name: "Pay securely by card" })).toBeVisible();
  expect(keys).toHaveLength(2); expect(keys[1]).toBe(keys[0]);
  await page.reload();
  await expect(page.getByRole("link", { name: "Pay securely by card" })).toBeVisible();
  paid = true;
  await page.getByRole("button", { name: "Check payment status" }).click();
  await expect(page.getByText(/Paid online. Show your order number/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Pay securely by card" })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("bubble-tea:card-attempt:v1"))).toBeNull();
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(audit.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("staff complete a verified card order without collecting cash", async ({ page }) => {
  await page.goto("/staff/sign-in");
  await page.getByLabel("Email address").fill("manager@manager.com");
  await page.getByLabel("Password", { exact: true }).fill("Manager@1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  let completed = false;
  const order = () => ({ id: "80000000-0000-0000-0000-000000000001", publicOrderNumber: "BT-CARD-STAFF", status: completed ? "COMPLETED" : "PENDING",
    paymentMethod: "CARD", paymentStatus: "PAID", currencyCode: "SGD", subtotalMinor: 660, totalMinor: 660, itemQuantity: 1,
    createdAt: "2026-09-15T00:00:00Z", completedAt: completed ? "2026-09-15T00:01:00Z" : null, paidAt: "2026-09-15T00:00:30Z",
    lines: [{ lineNumber: 1, productName: "Test tea", variantName: "Medium", quantity: 1, unitPriceMinor: 660, lineTotalMinor: 660, options: [] }], requirements: [] });
  await page.route("**/api/v1/staff/organizations/*/locations/*/orders**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/card-payment/refresh")) await route.fulfill({ json: { id: "90000000-0000-0000-0000-000000000001", state: "PAID", cancellationRequested: false,
      checkoutUrl: null, recoveryCode: null, refundedMinor: 0, expiresAt: "2030-01-01T00:00:00Z", order: { ...order(), replayed: false, items: order().lines } } });
    else if (path.endsWith("/completion")) { completed = true; await route.fulfill({ json: order() }); }
    else if (path.endsWith("/orders")) await route.fulfill({ json: { items: completed ? [] : [order()], page: 0, size: 25, totalItems: completed ? 0 : 1, totalPages: completed ? 0 : 1 } });
    else await route.fulfill({ json: order() });
  });
  await page.goto("/staff/orders");
  await page.getByRole("button", { name: "View BT-CARD-STAFF" }).click();
  await expect(page.getByText("No cash is due for this order.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Collect cash & complete" })).toHaveCount(0);
  await page.getByRole("button", { name: "Complete paid order" }).click();
  await page.getByRole("button", { name: "Confirm completion", exact: true }).click();
  await expect(page.getByText("No orders match this status.")).toBeVisible();
  expect(completed).toBe(true);
});
