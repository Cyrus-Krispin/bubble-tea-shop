import { chromium } from "../frontend/node_modules/@playwright/test/index.mjs";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const framesDir = path.join(root, "frames");
const appUrl = process.env.DEMO_APP_URL ?? "http://localhost:4173";
const metricsUrl = process.env.DEMO_METRICS_URL ?? "http://localhost:3000";
const studioUrl = process.env.DEMO_STUDIO_URL ?? "http://localhost:54323";
const staffEmail = process.env.DEMO_STAFF_EMAIL;
const staffPassword = process.env.DEMO_STAFF_PASSWORD;

if (!staffEmail || !staffPassword) {
  throw new Error("Set DEMO_STAFF_EMAIL and DEMO_STAFF_PASSWORD for the local demo account.");
}

await mkdir(framesDir, { recursive: true });
for (const file of await readdir(framesDir)) {
  if (/^\d{2}-[a-z-]+\.png$/.test(file)) await rm(path.join(framesDir, file));
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1365, height: 768 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
const page = await context.newPage();
const scenes = [];

async function settle(pageToCapture = page) {
  await pageToCapture.evaluate(() => document.fonts.ready);
  await pageToCapture.waitForFunction(() => [...document.images]
    .filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    })
    .every((image) => image.complete && image.naturalWidth > 0), null, { timeout: 8_000 });
  await pageToCapture.waitForTimeout(250);
}

async function center(locator) {
  if (!locator) return null;
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("A demo click target was not visible.");
  return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
}

async function capture(id, title, detail, duration, target, pageToCapture = page) {
  await settle(pageToCapture);
  const file = `${String(scenes.length + 1).padStart(2, "0")}-${id}.png`;
  const pointer = await center(target);
  await pageToCapture.screenshot({ path: path.join(framesDir, file), animations: "disabled" });
  scenes.push({ id, title, detail, duration, file, pointer });
  process.stdout.write(`${String(scenes.length).padStart(2, "0")} ${title}\n`);
}

try {
  await page.goto(appUrl);
  await page.getByRole("heading", { name: "Drinks made your way" }).waitFor();
  const locationButton = page.getByRole("button", { name: "Pickup at Orchard Central" });
  await capture("storefront", "FIND YOUR DRINK", "A real menu, ready to customize", 2.8, locationButton);

  await locationButton.click();
  const tiongLink = page.getByRole("link", { name: /Tiong Bahru/ });
  await tiongLink.waitFor();
  await capture("shop-picker", "CHOOSE A SHOP", "The menu follows the pickup location", 2.3, tiongLink);

  await tiongLink.click();
  await page.getByRole("button", { name: "Pickup at Tiong Bahru" }).waitFor();
  const customize = page.getByRole("link", { name: /Customize / }).first();
  await customize.waitFor();
  await capture("location-menu", "BROWSE THE MENU", "Products and prices come from the app", 2.8, customize);

  await customize.click();
  await page.getByRole("heading", { name: "Customize your drink" }).waitFor();
  const large = page.getByRole("radio", { name: /Large/ });
  await capture("customize", "MAKE IT YOURS", "Size, sweetness, ice, and toppings", 3.1, large);

  await large.check();
  const pearls = page.getByRole("checkbox", { name: /Pearls/ });
  await pearls.check();
  const addToOrder = page.getByRole("button", { name: /Add to order/ });
  await addToOrder.scrollIntoViewIfNeeded();
  await capture("priced-options", "SEE THE PRICE UPDATE", "Choices become a priced order", 2.8, addToOrder);

  await addToOrder.click();
  await page.getByRole("link", { name: "View order" }).click();
  await page.getByRole("heading", { name: "Your current order" }).waitFor();
  const placeOrder = page.getByRole("button", { name: /Place order ·/ });
  await capture("checkout", "READY FOR PICKUP", "Cash checkout in one step", 2.8, placeOrder);

  await placeOrder.click();
  await page.getByRole("heading", { name: /Pickup BT\d+/ }).waitFor();
  await capture("confirmation", "ORDER PLACED", "The shop receives a real order", 2.6, null);

  const staff = await context.newPage();
  await staff.goto(`${appUrl}/staff/sign-in`);
  await staff.getByLabel("Email address").fill(staffEmail);
  await staff.getByLabel("Password", { exact: true }).fill(staffPassword);
  await staff.getByRole("button", { name: "Sign in" }).click();
  await staff.getByRole("heading", { name: "Operations overview" }).waitFor();
  const ordersNav = staff.getByRole("navigation", { name: "Staff navigation" }).getByRole("link", { name: "Orders" });
  await capture("staff-overview", "BEHIND THE COUNTER", "One workspace for shop operations", 2.8, ordersNav, staff);

  await ordersNav.click();
  await staff.getByRole("heading", { name: "Location orders" }).waitFor();
  const locationSelect = staff.getByRole("combobox", { name: "Location" });
  await locationSelect.click();
  await staff.getByRole("option", { name: "Tiong Bahru" }).click();
  await staff.getByRole("table").waitFor();
  const staffNav = staff.getByRole("navigation", { name: "Staff navigation" });
  const catalogNav = staffNav.getByRole("link", { name: "Catalog" });
  await capture("staff-queue", "THE LIVE ORDER QUEUE", "Staff see orders for their shop", 2.8, catalogNav, staff);

  await catalogNav.click();
  await staff.getByRole("link", { name: "Recipes" }).click();
  await staff.getByRole("heading", { name: "Recipes" }).waitFor();
  const honeyRecipe = staff.getByRole("row").filter({ hasText: "Honey Peach Green Tea" }).getByRole("link", { name: "Open recipe" });
  await capture("recipes", "RECIPES BEHIND THE MENU", "Managers can inspect every formula", 2.5, honeyRecipe, staff);

  await honeyRecipe.click();
  await staff.getByRole("heading", { name: "Formula history" }).waitFor();
  const backToRecipes = staff.getByRole("link", { name: "Back to recipes" });
  await capture("recipe-ingredients", "MEASURED INGREDIENTS", "Green tea and peach syrup make the recipe", 2.5, backToRecipes, staff);

  await backToRecipes.click();
  const moonlitRecipe = staff.getByRole("row").filter({ hasText: "Moonlit Milk Tea" }).getByRole("link", { name: "Open recipe" });
  await moonlitRecipe.click();
  await staff.getByRole("heading", { name: "Formula history" }).waitFor();
  await capture("recipe-version", "PUBLISHED FORMULAS", "Ingredient quantities stay versioned", 2.6, null, staff);

  const inventoryNav = staffNav.getByRole("link", { name: "Inventory" });
  await inventoryNav.click();
  await staff.getByRole("heading", { name: "Consumption forecasts" }).waitFor();
  const forecasts = staff.getByRole("button", { name: "Show consumption forecasts" });
  await forecasts.click();
  await staff.getByText("Estimated stock remaining").waitFor();
  const teamNav = staffNav.getByRole("link", { name: "Team" });
  await capture("forecast", "PLAN THE NEXT BATCH", "Inventory and consumption forecasts", 3.0, teamNav, staff);

  await teamNav.click();
  await staff.getByRole("heading", { name: "Manager access" }).waitFor();
  const editAccess = staff.getByRole("button", { name: "Edit access" });
  await editAccess.scrollIntoViewIfNeeded();
  await capture("manager-access", "OWNER CONTROLS ACCESS", "Managers are assigned to specific shops", 2.5, editAccess, staff);

  await editAccess.click();
  await staff.getByRole("heading", { name: "Edit manager access" }).waitFor();
  await capture("manager-scope", "LOCATION-SCOPED ROLES", "The owner can change a manager's scope", 2.5, null, staff);

  const studio = await context.newPage();
  await studio.goto(`${studioUrl}/project/default/editor`);
  await studio.getByRole("heading", { name: "Table Editor" }).waitFor();
  await studio.getByPlaceholder("Search tables...").fill("recipe");
  await studio.getByRole("button").filter({ hasText: "recipeUnrestricted" }).first().click();
  await studio.getByText("recipe", { exact: true }).last().waitFor();
  await studio.waitForFunction(() => document.querySelectorAll('[role="row"]').length > 5);
  await studio.mouse.move(1000, 80);
  await capture("studio-recipes", "LOCAL POSTGRES TABLES", "Recipes live in application tables", 2.5, null, studio);

  await studio.getByRole("button").filter({ hasText: "recipe_version" }).first().click();
  await studio.getByText("recipe_version", { exact: true }).last().waitFor();
  await studio.waitForFunction(() => document.querySelectorAll('[role="row"]').length > 5);
  await studio.mouse.move(1000, 80);
  await capture("studio-versions", "VERSIONED IN THE DATABASE", "Supabase Studio shows the Flyway-owned tables", 2.5, null, studio);

  await studio.getByRole("link", { name: "Authentication" }).click();
  await studio.getByRole("heading", { name: "Users" }).waitFor();
  const userSearch = studio.getByPlaceholder("Search by email");
  await userSearch.fill("manager@manager.com");
  await userSearch.press("Enter");
  await studio.getByText("manager@manager.com", { exact: true }).waitFor();
  await studio.mouse.move(1000, 80);
  await capture("studio-users", "AUTH USERS", "Supabase identifies users; Spring checks shop access", 2.8, null, studio);

  const metrics = await context.newPage();
  await metrics.goto(metricsUrl);
  await metrics.getByText("Customer impact · RED signals").waitFor();
  await metrics.waitForTimeout(1_500);
  await capture("metrics", "SEE IT RUNNING", "Health and metrics in Grafana", 3.0, null, metrics);

  const manifest = {
    sourceCommit: execFileSync("git", ["rev-parse", "--short", "origin/main"], { cwd: path.join(root, ".."), encoding: "utf8" }).trim(),
    viewport: { width: 1365, height: 768 },
    scenes,
  };
  await writeFile(path.join(root, "scenes.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Captured ${scenes.length} scenes from main ${manifest.sourceCommit}.\n`);
} finally {
  await browser.close();
}
