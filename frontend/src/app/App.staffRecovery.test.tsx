import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { getCurrentAuthSession, subscribeToAuthState } from "../features/auth/authClient";
import type { AuthSession } from "../features/auth/types";
import { getStaffContext, type StaffContext } from "../features/staff/staffClient";
import { getCashFlow, recordExpense } from "../features/staff/cashFlowClient";
import { getGuestLocations, getGuestMenu } from "../features/catalog/catalogClient";
import { catalogLocations, catalogMenu } from "../test/catalogFixtures";

vi.mock("../features/auth/authClient", () => ({
  getCurrentAuthSession: vi.fn(), subscribeToAuthState: vi.fn(), signOut: vi.fn(),
}));
vi.mock("../features/staff/staffClient", async (original) => ({
  ...await original<typeof import("../features/staff/staffClient")>(), getStaffContext: vi.fn(),
}));
vi.mock("../features/staff/cashFlowClient", async (original) => ({
  ...await original<typeof import("../features/staff/cashFlowClient")>(), getCashFlow: vi.fn(), recordExpense: vi.fn(),
}));
vi.mock("../features/catalog/catalogClient", () => ({
  getGuestLocations: vi.fn(), getGuestMenu: vi.fn(), getGuestProduct: vi.fn(),
}));
const session: AuthSession = { userId: "staff-user", accessToken: "first-token", expiresAt: 4102444800, email: "staff@example.test" };
const context: StaffContext = { accountId: "staff-account", memberships: [{ organizationId: "org", organizationName: "Shop", role: "MANAGER",
  locations: [{ id: catalogLocations[0].id, name: "Shop", currencyCode: "SGD", timezone: "Asia/Singapore", defaultLocale: "en-SG" }] }] };
let authChanged: (session: AuthSession | null) => void;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGuestLocations).mockResolvedValue(catalogLocations);
  vi.mocked(getGuestMenu).mockResolvedValue(catalogMenu);
  vi.mocked(getCurrentAuthSession).mockResolvedValue(session);
  vi.mocked(subscribeToAuthState).mockImplementation((callback) => { authChanged = callback; return () => undefined; });
  vi.mocked(getStaffContext).mockResolvedValue(context);
  vi.mocked(getCashFlow).mockResolvedValue({ days: 7, currencyCode: "SGD", timezone: "Asia/Singapore", startDate: "2026-09-09", asOf: "2026-09-15T00:00:00Z",
    totals: [{ currencyCode: "SGD", incomeMinor: 0, outflowMinor: 0, netMinor: 0 }], daily: [], expenses: [], totalExpenses: 0, totalPages: 0, page: 0 });
  vi.mocked(recordExpense).mockRejectedValue(new Error("Lost response"));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
async function startUncertainExpense() {
  render(<MemoryRouter initialEntries={["/staff/cash-flow"]}>
    <nav aria-label="Test navigation"><Link to="/shop">Visit customer shop</Link><Link to="/staff/cash-flow">Return to cash flow</Link></nav><App />
  </MemoryRouter>);
  fireEvent.change(await screen.findByLabelText("Expense description"), { target: { value: "Tea paid" } });
  fireEvent.change(screen.getByLabelText("Amount paid (SGD)"), { target: { value: "12.34" } });
  fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
  await screen.findByText(/The outcome is unknown/);
  fireEvent.click(screen.getByRole("link", { name: "Visit customer shop" }));
  expect(screen.queryByLabelText("Expense description")).not.toBeInTheDocument();
}
it("recovers the same expense after leaving staff routes and refreshing the session token", async () => {
  await startUncertainExpense();
  await act(() => authChanged({ ...session, accessToken: "refreshed-token" }));
  fireEvent.click(screen.getByRole("link", { name: "Return to cash flow" }));
  expect(await screen.findByLabelText("Expense description")).toHaveValue("Tea paid");
  expect(screen.getByLabelText("Expense description")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry same expense" }));
  await vi.waitFor(() => expect(recordExpense).toHaveBeenCalledTimes(2));
  expect(vi.mocked(recordExpense).mock.calls[1].slice(1)).toEqual(vi.mocked(recordExpense).mock.calls[0].slice(1));
  expect(vi.mocked(recordExpense).mock.calls[1][0]).toBe("refreshed-token");
});
it.each(["sign-out", "account switch"])("discards private drafts on %s while outside staff routes", async (change) => {
  await startUncertainExpense();
  await act(() => authChanged(change === "sign-out" ? null : { ...session, userId: "other-user", accessToken: "other-token" }));
  await act(() => authChanged(session));
  fireEvent.click(screen.getByRole("link", { name: "Return to cash flow" }));
  expect(await screen.findByLabelText("Expense description")).toHaveValue("");
  expect(screen.getByLabelText("Expense description")).toBeEnabled();
  expect(recordExpense).toHaveBeenCalledTimes(1);
});
