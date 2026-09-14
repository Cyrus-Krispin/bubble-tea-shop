import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InventoryAlerts } from "./InventoryAlerts";

afterEach(() => vi.unstubAllGlobals());
it("announces projected shortages with their server-owned horizon", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    items: [{ ingredientId: "tea", ingredientName: "Tea", baseUnit: "GRAM", quantity: "50",
      dailyConsumption: "10", daysRemaining: "5", observedDays: 30, status: "ESTIMATED", reorderThreshold: null }],
    totalItems: 1, horizonDays: 7, calculatedAt: "2026-09-15T00:00:00Z",
  }), { headers: { "Content-Type": "application/json" } })));
  render(<InventoryAlerts accessToken="test-token" organizationId="org" locationId="loc" />);
  expect(await screen.findByText(/1 ingredient.*within 7 days/)).toBeVisible();
  expect(screen.getByText(/Tea.*5 days/)).toBeVisible();
});
it("does not present failed evaluation as healthy stock", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<InventoryAlerts accessToken="test-token" organizationId="org" locationId="loc" />);
  expect(await screen.findByText(/Stock alerts unavailable/)).toBeVisible();
});
