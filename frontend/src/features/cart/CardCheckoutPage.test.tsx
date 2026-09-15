import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { CardCheckoutPage } from "./CardCheckoutPage";
import { cardCheckout, type CardStatus } from "./cardClient";
import { useCart } from "./CartContext";
import { useAuth } from "../auth/useAuth";
vi.mock("./cardClient", () => ({ cardCheckout: vi.fn() }));
vi.mock("./CartContext", () => ({ useCart: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("../../app/CustomerHeader", () => ({ CustomerHeader: () => null }));
const finish = vi.fn();
const status = { id: "receipt", state: "PAID", cancellationRequested: true, checkoutUrl: null, refundedMinor: 0, recoveryCode: null,
  order: { id: "order", publicOrderNumber: "BT123", totalMinor: 500, currencyCode: "SGD", status: "PENDING", items: [] } } as unknown as CardStatus;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({ session: null } as ReturnType<typeof useAuth>);
  vi.mocked(useCart).mockReturnValue({ finishCard: finish, itemCount: 1, checkoutState: { busy: false } } as unknown as ReturnType<typeof useCart>);
});
function view() { return render(<MemoryRouter initialEntries={["/card-checkout/receipt"]}><Routes><Route path="/card-checkout/:id" element={<CardCheckoutPage />} /></Routes></MemoryRouter>); }
it("keeps a cancellation in recovery even if the last known payment was paid", async () => {
  vi.mocked(cardCheckout).mockResolvedValueOnce(status).mockResolvedValueOnce({ ...status, state: "REFUND_PENDING" })
    .mockResolvedValueOnce({ ...status, state: "REFUNDED", refundedMinor: 500 });
  view();
  await screen.findByText(/Cancelling this checkout/);
  expect(finish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  await screen.findByText(/Your cancellation is being processed/);
  expect(finish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check payment status" }));
  await screen.findByText(/Payment refunded/);
  expect(finish).toHaveBeenCalledExactlyOnceWith("receipt");
});
it("does not apply another checkout's account binding to this receipt", async () => {
  vi.mocked(useCart).mockReturnValue({ finishCard: finish, itemCount: 1, checkoutState: { busy: false, attempt: { cardId: "different", identity: "original" } } } as unknown as ReturnType<typeof useCart>);
  vi.mocked(cardCheckout).mockResolvedValue({ ...status, state: "OPEN", cancellationRequested: false });
  view();
  await waitFor(() => expect(cardCheckout).toHaveBeenCalledWith("receipt", "refresh"));
  expect(screen.queryByText(/Sign in to the original account/)).not.toBeInTheDocument();
});
