import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InventoryForecastPanel } from "./InventoryForecastPanel";

afterEach(() => vi.unstubAllGlobals());

it("loads real forecast results on request and labels limited history", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    items: [{ ingredientId: "tea", ingredientName: "Tea", baseUnit: "GRAM", quantity: "50",
      dailyConsumption: "10", daysRemaining: "5", observedDays: 7, status: "ESTIMATED", reorderThreshold: null, reorderReason: "PROJECTED" }],
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

it("shows why a threshold-only ingredient needs reordering despite unknown demand", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    items: [{ ingredientId: "tea", ingredientName: "Tea", baseUnit: "GRAM", quantity: "50",
      dailyConsumption: null, daysRemaining: null, observedDays: 0, status: "INSUFFICIENT_HISTORY",
      reorderThreshold: "100", reorderReason: "THRESHOLD" }],
    page: 0, size: 25, totalItems: 1, totalPages: 1, calculatedAt: "2026-09-15T00:00:00Z",
  }), { headers: { "Content-Type": "application/json" } })));
  render(<InventoryForecastPanel accessToken="test-token" organizationId="org" locationId="loc" mode="reorder" />);
  fireEvent.click(screen.getByRole("button", { name: "Show reorder list" }));
  expect(await screen.findByText("Below reorder threshold")).toBeVisible();
  expect(screen.getByText("Insufficient history")).toBeVisible();
});

function response(page: number, totalPages: number, name?: string) {
  return new Response(JSON.stringify({
    items: name ? [{ ingredientId: name, ingredientName: name, baseUnit: "GRAM", quantity: "50",
      dailyConsumption: "10", daysRemaining: "5", observedDays: 7, status: "ESTIMATED", reorderThreshold: null, reorderReason: "PROJECTED" }] : [],
    page, size: 25, totalItems: totalPages === 2 ? 26 : 24, totalPages, calculatedAt: "2026-09-15T00:00:00Z",
  }), { headers: { "Content-Type": "application/json" } });
}

it("recovers the last available page when restocking shrinks the reorder list", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(response(0, 2, "First page"))
    .mockResolvedValueOnce(response(1, 2, "Second page"))
    .mockResolvedValueOnce(response(1, 1))
    .mockResolvedValueOnce(response(0, 1, "Remaining ingredient")));
  render(<InventoryForecastPanel accessToken="token" organizationId="org" locationId="loc" mode="reorder" />);
  fireEvent.click(screen.getByRole("button", { name: "Show reorder list" }));
  await screen.findByText("First page");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("Second page");
  fireEvent.click(screen.getByRole("button", { name: "Refresh reorder list" }));
  expect(await screen.findByText("Remaining ingredient")).toBeVisible();
  expect(screen.queryByText("No ingredients need reordering.")).not.toBeInTheDocument();
});

it("refreshes an open panel after an inventory update without closing it", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(0, 1, "Before receipt"))
    .mockResolvedValueOnce(response(0, 1, "After receipt")));
  const props = { accessToken: "token", organizationId: "org", locationId: "loc" };
  const { rerender } = render(<InventoryForecastPanel {...props} refreshVersion={0} />);
  fireEvent.click(screen.getByRole("button", { name: "Show consumption forecasts" }));
  await screen.findByText("Before receipt");
  rerender(<InventoryForecastPanel {...props} refreshVersion={1} />);
  expect(await screen.findByText("After receipt")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Show consumption forecasts" })).not.toBeInTheDocument();
});
