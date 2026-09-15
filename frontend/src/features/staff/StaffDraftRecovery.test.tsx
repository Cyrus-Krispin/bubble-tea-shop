import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthContext } from "../auth/AuthContext";
import { StaffLayout } from "./StaffLayout";
import { catalogLocations, catalogMenu, catalogProduct } from "../../test/catalogFixtures";
import CounterOrderPage from "./CounterOrderPage";
import { placeCounterOrder, OrderError } from "../cart/orderClient";
import CashFlowPage from "./CashFlowPage";
import { getStaffContext, type StaffContext } from "./staffClient";
import { getCashFlow, recordExpense } from "./cashFlowClient";
vi.mock("./staffClient", async (original) => ({ ...await original<typeof import("./staffClient")>(), getStaffContext: vi.fn() }));
vi.mock("./cashFlowClient", async (original) => ({ ...await original<typeof import("./cashFlowClient")>(), getCashFlow: vi.fn(), recordExpense: vi.fn() }));
vi.mock("../catalog/catalogClient", () => ({
  getGuestLocations: vi.fn().mockResolvedValue(catalogLocations), getGuestMenu: vi.fn().mockResolvedValue(catalogMenu), getGuestProduct: vi.fn().mockResolvedValue(catalogProduct),
}));
vi.mock("../cart/orderClient", async (original) => ({ ...await original<typeof import("../cart/orderClient")>(), placeCounterOrder: vi.fn() }));
const context: StaffContext = { accountId: "staff", memberships: [{ organizationId: "org", organizationName: "Shop", role: "MANAGER",
  locations: [{ id: catalogLocations[0].id, name: "Shop", currencyCode: "SGD", timezone: "Asia/Singapore", defaultLocale: "en-SG" }] }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffContext).mockResolvedValue(context);
  vi.mocked(getCashFlow).mockResolvedValue({ days: 7, currencyCode: "SGD", timezone: "Asia/Singapore", startDate: "2026-09-09", asOf: "2026-09-15T00:00:00Z",
    totals: [{ currencyCode: "SGD", incomeMinor: 0, outflowMinor: 0, netMinor: 0 }], daily: [], expenses: [], totalExpenses: 0, totalPages: 0, page: 0 });
  vi.mocked(recordExpense).mockRejectedValue(new Error("Lost response"));
});
function app(token: string, counter = false) {
  return <AuthContext.Provider value={{ isLoading: false, session: { userId: "test-user", accessToken: token, expiresAt: 4102444800, email: "staff@example.test" } }}>
    <MemoryRouter initialEntries={[counter ? "/staff/counter" : "/staff/cash-flow"]}><Routes><Route path="/staff" element={<StaffLayout />}><Route path="cash-flow" element={<CashFlowPage />} /><Route path="counter" element={<CounterOrderPage />} /></Route></Routes></MemoryRouter>
  </AuthContext.Provider>;
}
it("restores an uncertain expense after real staff access revalidation unmounts the route", async () => {
  const view = render(app("first-token"));
  await screen.findByLabelText("Expense description");
  fireEvent.change(screen.getByLabelText("Expense description"), { target: { value: "Tea paid" } });
  fireEvent.change(screen.getByLabelText("Amount paid (SGD)"), { target: { value: "12.34" } });
  fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
  await screen.findByText(/The outcome is unknown/);
  let resolve: (value: StaffContext) => void = () => undefined;
  vi.mocked(getStaffContext).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  view.rerender(app("refreshed-token"));
  expect(await screen.findByText("Loading your access…")).toBeVisible();
  expect(screen.queryByLabelText("Expense description")).not.toBeInTheDocument();
  await act(async () => resolve(context));
  expect(await screen.findByLabelText("Expense description")).toHaveValue("Tea paid");
  expect(screen.getByLabelText("Expense description")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry same expense" }));
  await vi.waitFor(() => expect(recordExpense).toHaveBeenCalledTimes(2));
  expect(vi.mocked(recordExpense).mock.calls[1].slice(1)).toEqual(vi.mocked(recordExpense).mock.calls[0].slice(1));
  expect(vi.mocked(recordExpense).mock.calls[1][0]).toBe("refreshed-token");
});
it("does not expose a previous account's draft when another account resolves", async () => {
  const view = render(app("first-token")); await screen.findByLabelText("Expense description");
  fireEvent.change(screen.getByLabelText("Expense description"), { target: { value: "Private expense" } });
  vi.mocked(getStaffContext).mockResolvedValueOnce({ ...context, accountId: "different-staff" });
  view.rerender(app("another-account-token"));
  expect(await screen.findByLabelText("Expense description")).toHaveValue("");
});

it("recovers counter lines and their original key across refresh and a later forbidden retry", async () => {
  vi.mocked(placeCounterOrder).mockRejectedValueOnce(new Error("Lost response"))
    .mockRejectedValueOnce(new OrderError("ORDER_UNAVAILABLE", 403)).mockRejectedValue(new Error("Still offline"));
  const view = render(app("first-token", true));
  fireEvent.click(await screen.findByRole("button", { name: /^Add drink/ }));
  fireEvent.click(screen.getByRole("button", { name: "Place counter order" }));
  await screen.findByText(/outcome is not yet known/);
  let resolve: (value: StaffContext) => void = () => undefined;
  vi.mocked(getStaffContext).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  view.rerender(app("refreshed-token", true));
  expect(await screen.findByText("Loading your access…")).toBeVisible();
  await act(async () => resolve(context));
  fireEvent.click(await screen.findByRole("button", { name: "Retry same order" }));
  await screen.findByText(/outcome is not yet known/);
  fireEvent.click(screen.getByRole("button", { name: "Retry same order" }));
  await vi.waitFor(() => expect(placeCounterOrder).toHaveBeenCalledTimes(3));
  const calls = vi.mocked(placeCounterOrder).mock.calls;
  expect(calls[0].slice(1)).toEqual(calls[1].slice(1)); expect(calls[0].slice(1)).toEqual(calls[2].slice(1));
  expect(calls[1][0]).toBe("refreshed-token");
});

it("keeps a pending expense single-flight across refresh and retains the originally selected shop", async () => {
  let reject: (error: Error) => void = () => undefined;
  vi.mocked(recordExpense).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  const view = render(app("first-token")); await screen.findByLabelText("Expense description");
  fireEvent.change(screen.getByLabelText("Expense description"), { target: { value: "Pending payment" } });
  fireEvent.change(screen.getByLabelText("Amount paid (SGD)"), { target: { value: "12.34" } });
  fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
  vi.mocked(getStaffContext).mockResolvedValueOnce({ ...context, memberships: [{ ...context.memberships[0], locations: [
    { ...context.memberships[0].locations[0], id: "new-first-shop", name: "New shop first" }, ...context.memberships[0].locations,
  ] }] });
  view.rerender(app("refreshed-token"));
  const description = await screen.findByLabelText("Expense description");
  expect(description).toHaveValue("Pending payment");
  expect(screen.getByRole("combobox", { name: "Shop" })).toHaveTextContent("Shop");
  const pending = screen.getByRole("button", { name: "Recording expense…" });
  expect(pending).toBeDisabled(); fireEvent.click(pending);
  expect(recordExpense).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Connection lost")));
  fireEvent.click(await screen.findByRole("button", { name: "Retry same expense" }));
  await vi.waitFor(() => expect(recordExpense).toHaveBeenCalledTimes(2));
  expect(vi.mocked(recordExpense).mock.calls[1].slice(1)).toEqual(vi.mocked(recordExpense).mock.calls[0].slice(1));
});

it("shows no payment due for a cancelled counter replay", async () => {
  vi.mocked(placeCounterOrder).mockResolvedValue({ id: "order", publicOrderNumber: "BT123", status: "CANCELLED", paymentMethod: "CASH", currencyCode: "SGD", subtotalMinor: 660, totalMinor: 660, createdAt: "2026-09-15T00:00:00Z", replayed: true, items: [] });
  render(app("token", true));
  fireEvent.click(await screen.findByRole("button", { name: /^Add drink/ }));
  fireEvent.click(screen.getByRole("button", { name: "Place counter order" }));
  expect(await screen.findByText(/This order was cancelled. Do not collect payment./)).toBeVisible();
  expect(screen.queryByText(/Collect cash and complete/)).not.toBeInTheDocument();
});
