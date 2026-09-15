import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { expect, it, vi } from "vitest";
import CounterOrderPage from "./CounterOrderPage";

vi.mock("../catalog/catalogClient", () => ({
  getGuestLocations: vi.fn().mockResolvedValue([{ id: "loc", slug: "shop", name: "Shop", currency: "SGD", imageKey: "shop" }]),
  getGuestMenu: vi.fn().mockResolvedValue({ location: { id: "loc", slug: "shop", currency: "SGD" }, products: [] }),
}));

it("shows only available scoped locations and a real empty menu", async () => {
  render(<MemoryRouter initialEntries={["/staff/counter"]}><Routes>
    <Route path="/staff" element={<Outlet context={{ accessToken: "test-token", staffContext: { accountId: "staff", memberships: [
      { organizationId: "org", organizationName: "Shop", role: "MANAGER", locations: [{ id: "loc", name: "Shop", currencyCode: "SGD", timezone: "Asia/Singapore" }] },
    ] } }} />}><Route path="counter" element={<CounterOrderPage />} /></Route>
  </Routes></MemoryRouter>);
  expect(await screen.findByText("No drinks are available at this shop.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Place counter order" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Clear order" }));
  expect(screen.getByText("Add drinks to begin this counter order.")).toBeVisible();
});
