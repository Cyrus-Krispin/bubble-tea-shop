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
  if (/^\d{2}-[a-z-]+(?:-\d{3})?\.png$/.test(file)) await rm(path.join(framesDir, file));
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1365, height: 768 },
  deviceScaleFactor: 2,
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

async function capture(id, title, detail, duration, target, pageToCapture = page, options = {}) {
  await settle(pageToCapture);
  const file = `${String(scenes.length + 1).padStart(2, "0")}-${id}.png`;
  const pointer = await center(target);
  await pageToCapture.screenshot({ path: path.join(framesDir, file), animations: "disabled" });
  scenes.push({ id, title, detail, duration, file, pointer, ...options });
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
  await capture("shop-picker", "CHOOSE A SHOP", "The menu follows the pickup location", 2.3, tiongLink, page, {
    camera: { zoom: 1.1, x: 1060, y: 390, motion: "in" },
  });

  await tiongLink.click();
  await page.getByRole("button", { name: "Pickup at Tiong Bahru" }).waitFor();
  const customize = page.getByRole("link", { name: /Customize / }).first();
  await customize.waitFor();
  await capture("location-menu", "BROWSE THE MENU", "Products and prices come from the app", 2.8, customize, page, {
    camera: { zoom: 1.1, x: 500, y: 450, toX: 340, toY: 530, motion: "pan" },
  });

  await customize.click();
  await page.getByRole("heading", { name: "Customize your drink" }).waitFor();
  const large = page.getByRole("radio", { name: /Large/ });
  if (await large.isChecked()) throw new Error("Large must start unselected for the demo action.");
  const sizeCamera = { zoom: 1.18, x: 950, y: 280 };
  await capture("customize", "CHOOSE YOUR SIZE", "Pick Large and watch the price change", 2.2, large, page, {
    camera: { ...sizeCamera, motion: "in" },
  });

  await large.check();
  if (!(await large.isChecked())) throw new Error("Large size was not selected in the captured UI.");
  await capture("large-selected", "LARGE, SELECTED", "The choice is visible and the price updates", 1.5, large, page, {
    camera: { ...sizeCamera, motion: "hold" },
    cursorAction: "hover",
  });

  const pearls = page.getByRole("checkbox", { name: /Pearls/ });
  if (await pearls.isChecked()) throw new Error("Pearls must start unselected for the demo action.");
  const scrollStart = await page.evaluate(() => window.scrollY);
  const pearlBeforeScroll = await center(pearls);
  const scrollTarget = scrollStart + pearlBeforeScroll.y - 384;
  const toppingsFrames = [];
  const toppingsPrefix = `${String(scenes.length + 1).padStart(2, "0")}-scroll-toppings`;
  for (let step = 0; step < 24; step++) {
    const progress = step / 23;
    const eased = progress * progress * (3 - 2 * progress);
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), scrollStart + (scrollTarget - scrollStart) * eased);
    const file = `${toppingsPrefix}-${String(step).padStart(3, "0")}.png`;
    await page.screenshot({ path: path.join(framesDir, file), animations: "disabled" });
    toppingsFrames.push(file);
  }
  const pearlAfterScroll = await center(pearls);
  scenes.push({
    id: "scroll-toppings",
    title: "FOLLOW THE CUSTOMIZATION",
    detail: "Move down to the optional toppings",
    duration: 1.5,
    file: toppingsFrames[0],
    frameFiles: toppingsFrames,
    pointer: pearlAfterScroll,
    camera: { zoom: 1.18, x: 950, y: 280, toY: 390, motion: "pan" },
    cursorAction: "hover",
  });
  process.stdout.write(`${String(scenes.length).padStart(2, "0")} FOLLOW THE CUSTOMIZATION\n`);

  const toppingsCamera = { zoom: 1.18, x: 950, y: 390 };
  await capture("pearls-choice", "ADD A TOPPING", "Pearls are an optional extra", 1.8, pearls, page, {
    camera: { ...toppingsCamera, motion: "hold" },
  });
  await pearls.check();
  if (!(await pearls.isChecked())) throw new Error("Pearls were not selected in the captured UI.");
  const addToOrder = page.getByRole("button", { name: /Add to order/ });
  await capture("pearls-selected", "PEARLS, ADDED", "The selected topping appears in the order", 1.6, addToOrder, page, {
    camera: { ...toppingsCamera, toY: 560, motion: "pan" },
    cursorAction: "hover",
  });
  await addToOrder.scrollIntoViewIfNeeded();
  await capture("priced-options", "SEE THE PRICE UPDATE", "Choices become a priced order", 2.2, addToOrder, page, {
    camera: { zoom: 1.18, x: 950, y: 560, motion: "hold" },
  });

  await addToOrder.click();
  await page.getByRole("link", { name: "View order" }).click();
  await page.getByRole("heading", { name: "Your current order" }).waitFor();
  const placeOrder = page.getByRole("button", { name: /Place order ·/ });
  await capture("checkout", "READY FOR PICKUP", "Cash checkout in one step", 2.8, placeOrder, page, {
    camera: { zoom: 1.1, x: 870, y: 400, toX: 990, toY: 540, motion: "pan" },
  });

  await placeOrder.click();
  await page.getByRole("heading", { name: /Pickup BT\d+/ }).waitFor();
  await capture("confirmation", "ORDER PLACED", "The shop receives a real order", 2.6, null, page, {
    camera: { zoom: 1.08, x: 690, y: 340, motion: "hold" },
  });

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
  await capture("staff-queue", "THE LIVE ORDER QUEUE", "Staff see orders for their shop", 2.8, catalogNav, staff, {
    camera: { zoom: 1.09, x: 850, y: 300, toY: 500, motion: "pan" },
  });

  await catalogNav.click();
  await staff.getByRole("link", { name: "Recipes" }).click();
  await staff.getByRole("heading", { name: "Recipes" }).waitFor();
  const honeyRecipe = staff.getByRole("row").filter({ hasText: "Honey Peach Green Tea" }).getByRole("link", { name: "Open recipe" });
  await capture("recipes", "RECIPES BEHIND THE MENU", "Managers can inspect every formula", 2.5, honeyRecipe, staff, {
    camera: { zoom: 1.1, x: 750, y: 320, toX: 930, toY: 470, motion: "pan" },
  });

  await honeyRecipe.click();
  await staff.getByRole("heading", { name: "Formula history" }).waitFor();
  const backToRecipes = staff.getByRole("link", { name: "Back to recipes" });
  await capture("recipe-ingredients", "MEASURED INGREDIENTS", "Green tea and peach syrup make the recipe", 2.5, backToRecipes, staff, {
    camera: { zoom: 1.1, x: 840, y: 300, toY: 460, motion: "pan" },
  });

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
  await capture("manager-access", "OWNER CONTROLS ACCESS", "Managers are assigned to specific shops", 2.5, editAccess, staff, {
    camera: { zoom: 1.12, x: 900, y: 350, toY: 520, motion: "pan" },
  });

  await editAccess.click();
  await staff.getByRole("heading", { name: "Edit manager access" }).waitFor();
  await capture("manager-scope", "LOCATION-SCOPED ROLES", "The owner can change a manager's scope", 2.5, null, staff);

  const studio = await context.newPage();
  await studio.goto(`${studioUrl}/project/default/database/schemas`);
  await studio.getByText("Loading tables").waitFor({ state: "hidden" });
  await studio.waitForFunction(() => document.querySelectorAll(".react-flow__node").length > 0);
  await settle(studio);

  // Pan the real Schema Visualizer canvas from its upper tables through the
  // connected order, inventory, and catalog tables. Each frame is a browser
  // screenshot; the renderer never warps or blends application content.
  for (let stroke = 0; stroke < 3; stroke++) {
    await studio.mouse.move(350, 150);
    await studio.mouse.down();
    await studio.mouse.move(350, 650, { steps: 10 });
    await studio.mouse.up();
  }
  const schemaFrameFiles = [];
  const schemaPrefix = `${String(scenes.length + 1).padStart(2, "0")}-studio-schema`;
  async function captureSchemaFrame() {
    const file = `${schemaPrefix}-${String(schemaFrameFiles.length).padStart(3, "0")}.png`;
    await studio.screenshot({ path: path.join(framesDir, file), animations: "disabled" });
    schemaFrameFiles.push(file);
  }
  await captureSchemaFrame();
  for (let stroke = 0; stroke < 7; stroke++) {
    await studio.mouse.move(350, 650);
    await studio.mouse.down();
    for (let step = 0; step < 10; step++) {
      await studio.mouse.move(350, 600 - step * 50);
      await captureSchemaFrame();
    }
    await studio.mouse.up();
  }
  scenes.push({
    id: "studio-schema",
    title: "THE CONNECTED DATA MODEL",
    detail: "Supabase Studio maps the tables and their relationships",
    duration: 7.0,
    file: schemaFrameFiles[0],
    frameFiles: schemaFrameFiles,
    pointer: null,
  });
  process.stdout.write(`${String(scenes.length).padStart(2, "0")} THE CONNECTED DATA MODEL\n`);

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
