import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InventoryForecastPanel } from "./InventoryForecastPanel";

afterEach(() => vi.unstubAllGlobals());

it("loads real forecast results on request and labels limited history", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    items: [{ ingredientId: "tea", ingredientName: "Tea", baseUnit: "GRAM", quantity: "50",
      dailyConsumption: "10", daysRemaining: "5", observedDays: 7, status: "ESTIMATED", reorderThreshold: null }],
    page: 0, size: 25, totalItems: 1, totalPages: 1, calculatedAt: "2026-09-15T00:00:00Z",
  }), { headers: { "Content-Type": "application/json" } })));
  render(<InventoryForecastPanel accessToken="test-token" organizationId="org" locationId="loc" />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Show consumption forecasts" }));
  expect(await screen.findByText("Tea")).toBeVisible();
  expect(screen.getByText("5 days")).toBeVisible();
  expect(screen.getByText("7 days · limited history")).toBeVisible();
});

it("shows an actionable error for unavailable or malformed forecasts", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
  render(<InventoryForecastPanel accessToken="test-token" organizationId="org" locationId="loc" />);
  fireEvent.click(screen.getByRole("button", { name: "Show consumption forecasts" }));
  expect(await screen.findByText("Forecasts unavailable")).toBeVisible();
  expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
});
