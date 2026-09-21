import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { selectOption } from "../../test/selectOption";
import OwnerLocationsPage from "./OwnerLocationsPage";
import { createOwnerLocation, getOwnerLocations } from "./currencyClient";
vi.mock("./currencyClient", () => ({ createOwnerLocation: vi.fn(), getOwnerLocations: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getOwnerLocations).mockResolvedValue([]); });
function renderPage(role = "OWNER") { const refresh = vi.fn(); render(<MemoryRouter><Routes><Route element={<Outlet context={{ accessToken: "token", refreshAccess: refresh, staffContext: { memberships: [{ organizationId: "org", organizationName: "Tea", role }] } }} />}><Route index element={<OwnerLocationsPage />} /></Route></Routes></MemoryRouter>); return refresh; }
it("creates a location with the chosen settlement currency and refreshes staff access", async () => {
  vi.mocked(createOwnerLocation).mockResolvedValue({ id: "shop", name: "KL Shop", slug: "kl-shop", currencyCode: "MYR", timezone: "Asia/Kuala_Lumpur", defaultLocale: "ms-MY", active: true });
  const refresh = renderPage();
  fireEvent.change(screen.getByLabelText("Shop name"), { target: { value: "KL Shop" } });
  fireEvent.change(screen.getByLabelText("Public shop URL"), { target: { value: "kl-shop" } });
  await selectOption(screen.getByRole("combobox", { name: "Settlement currency" }), "MYR");
  await selectOption(screen.getByRole("combobox", { name: "Shop timezone" }), "Asia/Kuala_Lumpur");
  await selectOption(screen.getByRole("combobox", { name: "Default language" }), "Malay");
  fireEvent.click(screen.getByRole("button", { name: "Create shop" }));
  expect(await screen.findByText(/KL Shop created/)).toBeVisible();
  expect(refresh).toHaveBeenCalledOnce();
  expect(createOwnerLocation).toHaveBeenCalledWith("token", "org", { name: "KL Shop", slug: "kl-shop", currencyCode: "MYR", timezone: "Asia/Kuala_Lumpur", defaultLocale: "ms-MY" });
});
it("does not expose owner creation to managers", () => { renderPage("MANAGER"); expect(screen.queryByRole("button", { name: "Create shop" })).toBeNull(); expect(getOwnerLocations).not.toHaveBeenCalled(); });
