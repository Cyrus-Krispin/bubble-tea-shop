import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import CashFlowPage from "./CashFlowPage";
import { getCashFlow, recordExpense } from "./cashFlowClient";
vi.mock("./cashFlowClient", async (original) => ({ ...await original<typeof import("./cashFlowClient")>(), getCashFlow: vi.fn(), recordExpense: vi.fn() }));
beforeEach(() => {
  vi.mocked(getCashFlow).mockResolvedValue({ days: 7, currencyCode: "SGD", timezone: "Asia/Singapore", startDate: "2026-09-09", asOf: "2026-09-15T00:00:00Z",
    totals: [{ currencyCode: "SGD", incomeMinor: 2000, outflowMinor: 500, netMinor: 1500 }], daily: [], expenses: [], totalExpenses: 0, totalPages: 0, page: 0 });
});
function renderPage() {
  render(<MemoryRouter><Routes><Route element={<Outlet context={{ accessToken: "token", staffContext: { memberships: [
    { organizationId: "org", locations: [{ id: "loc", name: "Shop", currencyCode: "SGD" }] },
  ] } }} />}><Route index element={<CashFlowPage />} /></Route></Routes></MemoryRouter>);
}
it("shows collected money and explicit expenses with an empty history", async () => {
  renderPage();
  expect(await screen.findByText("$20.00")).toBeVisible();
  expect(screen.getByText("$5.00")).toBeVisible(); expect(screen.getByText("$15.00")).toBeVisible();
  expect(screen.getByText("No expenses recorded in this period.")).toBeVisible();
});
it("freezes an uncertain expense and retries with the same key", async () => {
  vi.mocked(recordExpense).mockRejectedValue(new Error("Network disconnected"));
  renderPage(); await screen.findByText("$20.00");
  fireEvent.change(screen.getByLabelText("Expense description"), { target: { value: "Tea paid" } });
  fireEvent.change(screen.getByLabelText("Amount paid (SGD)"), { target: { value: "12.34" } });
  fireEvent.click(screen.getByRole("button", { name: "Record expense" }));
  await screen.findByText(/The outcome is unknown/);
  expect(screen.getByLabelText("Expense description")).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Shop" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry same expense" }));
  await vi.waitFor(() => expect(recordExpense).toHaveBeenCalledTimes(2));
  expect(vi.mocked(recordExpense).mock.calls[0]).toEqual(vi.mocked(recordExpense).mock.calls[1]);
});
