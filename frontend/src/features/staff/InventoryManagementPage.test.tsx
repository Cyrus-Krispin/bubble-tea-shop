import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffDraftProvider } from "./StaffDraftProvider";
import { expectNoAccessibilityViolations } from "../../test/accessibility";
import { selectOption } from "../../test/selectOption";
vi.mock("./inventoryClient", () => ({
  getInventoryBalances: vi.fn(),
  getInventoryMovements: vi.fn(),
  recordInventoryMovement: vi.fn(),
  InventoryError: class InventoryError extends Error {
    constructor(
      public code: string,
      public status: number,
      public shortages: Readonly<
        Record<string, { available: string; requested: string }>
      > = {},
    ) {
      super(code);
    }
  },
}));

import InventoryManagementPage from "./InventoryManagementPage";
import {
  getInventoryBalances,
  getInventoryMovements,
  InventoryError,
  recordInventoryMovement,
} from "./inventoryClient";

const organizationId = "88b23060-cbc4-4218-9938-63d75f6f324c";
const locationId = "42eeb769-306a-4b1a-97cc-350e2e9ea90b";
const ingredientId = "a20d5547-69bb-4cb1-b9cc-d699629c49dc";
const outletContext = {
  accessToken: "staff-token",
  staffContext: {
    accountId: "35f942a3-0591-4973-83ef-8889f608184e",
    memberships: [
      {
        organizationId,
        organizationName: "Bubble Tea Operations",
        role: "OWNER" as const,
        locations: [
          {
            id: locationId,
            name: "Orchard Central",
            timezone: "Asia/Singapore",
            defaultLocale: "en-SG",
            currencyCode: "SGD",
          },
        ],
      },
    ],
  },
};
const balance = {
  ingredientId,
  ingredientName: "Assam Tea",
  sku: "TEA-001",
  baseUnit: "GRAM" as const,
  quantity: "4.000000",
  reservedQuantity: "0",
  availableQuantity: "4.000000",
  reorderThreshold: "5.000000",
  belowReorderThreshold: true,
  version: 1,
  openingRecorded: true,
  ingredientArchived: false,
  updatedAt: "2026-08-22T00:00:00Z",
};
const movement = {
  id: "movement-id",
  ingredientId,
  ingredientName: "Assam Tea",
  baseUnit: "GRAM" as const,
  movementType: "RECEIPT" as const,
  quantityDelta: "10.500000",
  customerOrderId: null,
  sourceReference: "PO-42",
  note: null,
  totalCostMinor: 1299,
  currencyCode: "SGD",
  createdAt: "2026-08-22T00:00:00Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/staff/inventory"]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />} path="/staff">
          <Route element={<InventoryManagementPage />} path="inventory" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("InventoryManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInventoryBalances).mockResolvedValue({
      items: [balance],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getInventoryMovements).mockResolvedValue({
      items: [movement],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(recordInventoryMovement).mockResolvedValue(movement);
  });

  it("retains an unknown movement through route removal and a later forbidden response", async () => {
    vi.mocked(recordInventoryMovement).mockRejectedValueOnce(new Error("Lost response"))
      .mockRejectedValueOnce(new InventoryError("STAFF_ACCESS_DENIED", 403)).mockResolvedValueOnce(movement);
    const app = (visible: boolean, token = "staff-token") => <StaffDraftProvider>
      <MemoryRouter initialEntries={["/staff/inventory"]}><Routes>
        <Route element={<Outlet context={{ ...outletContext, accessToken: token }} />} path="/staff">
          <Route element={visible ? <InventoryManagementPage /> : <p>Rechecking staff access</p>} path="inventory" />
        </Route></Routes></MemoryRouter></StaffDraftProvider>;
    const view = render(app(true));
    fireEvent.click(await screen.findByRole("button", { name: "Record" }));
    fireEvent.change(screen.getByLabelText("Quantity (g)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Record movement" }));
    await screen.findByText(/The outcome is unknown/);
    expect(screen.getByLabelText("Quantity (g)")).toBeDisabled();
    const original = vi.mocked(recordInventoryMovement).mock.calls[0];
    view.rerender(app(false));
    vi.mocked(getInventoryBalances).mockResolvedValue({ items: [], page: 0, size: 25, totalItems: 0, totalPages: 0 });
    view.rerender(app(true, "refreshed-token"));
    expect(await screen.findByLabelText("Quantity (g)")).toHaveValue("100");
    fireEvent.click(screen.getByRole("button", { name: "Retry same movement" }));
    await waitFor(() => expect(recordInventoryMovement).toHaveBeenCalledTimes(2));
    await screen.findByText(/The outcome is unknown/);
    expect(screen.getByLabelText("Quantity (g)")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry same movement" }));
    await waitFor(() => expect(recordInventoryMovement).toHaveBeenCalledTimes(3));
    for (const call of vi.mocked(recordInventoryMovement).mock.calls.slice(1)) {
      expect(call.slice(1)).toEqual(original.slice(1)); expect(call[0]).toBe("refreshed-token");
    }
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reloads current balances when an older in-flight request succeeds after remount", async () => {
    let resolve: (value: typeof movement) => void = () => undefined;
    vi.mocked(recordInventoryMovement).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const app = (visible: boolean) => <StaffDraftProvider><MemoryRouter initialEntries={["/staff/inventory"]}>
      <Routes><Route element={<Outlet context={outletContext} />} path="/staff">
        <Route element={visible ? <InventoryManagementPage /> : <p>Reloading access</p>} path="inventory" />
      </Route></Routes></MemoryRouter></StaffDraftProvider>;
    const view = render(app(true)); fireEvent.click(await screen.findByRole("button", { name: "Record" }));
    fireEvent.change(screen.getByLabelText("Quantity (g)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Record movement" }));
    view.rerender(app(false)); view.rerender(app(true));
    await screen.findByRole("button", { name: "Recording movement" });
    await waitFor(() => expect(getInventoryBalances).toHaveBeenCalledTimes(2));
    vi.mocked(getInventoryBalances).mockResolvedValue({ items: [{ ...balance, quantity: "104.000000" }], page: 0, size: 25, totalItems: 1, totalPages: 1 });
    await act(async () => resolve(movement));
    expect(await screen.findByText("104.000000 g")).toBeVisible();
    expect(getInventoryBalances).toHaveBeenCalledTimes(3);
    expect(getInventoryMovements).toHaveBeenCalledTimes(3);
  });

  it("blocks duplicate submits while a movement request is pending", async () => {
    vi.mocked(recordInventoryMovement).mockReturnValueOnce(new Promise(() => {}));
    renderPage(); fireEvent.click(await screen.findByRole("button", { name: "Record" }));
    fireEvent.change(screen.getByLabelText("Quantity (g)"), { target: { value: "100" } });
    const form = screen.getByRole("button", { name: "Record movement" }).closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(recordInventoryMovement).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Recording movement" })).toBeDisabled();
  });

  it("loads balances and immutable history within the server-provided staff scope", async () => {
    const { container } = renderPage();

    expect(await screen.findByText("4.000000 g")).toBeInTheDocument();
    await expectNoAccessibilityViolations(container);
    expect(screen.getByText("Low stock")).toBeInTheDocument();
    expect(screen.getByText("PO-42")).toBeInTheDocument();
    expect(getInventoryBalances).toHaveBeenCalledWith(
      "staff-token",
      organizationId,
      locationId,
      { includeArchived: false, page: 0, query: undefined, size: 25 },
      expect.any(AbortSignal),
    );
    expect(getInventoryMovements).toHaveBeenCalledWith(
      "staff-token",
      organizationId,
      locationId,
      { ingredientId: undefined, movementType: undefined, page: 0, size: 25 },
      expect.any(AbortSignal),
    );
  });

  it("records a receipt without client-owned actor, location currency, or balance data", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Record" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Quantity (g)"), {
      target: { value: "10.500000" },
    });
    fireEvent.change(within(dialog).getByLabelText("Source reference"), {
      target: { value: "PO-42" },
    });
    fireEvent.change(
      within(dialog).getByLabelText("Total cost (SGD minor units)"),
      { target: { value: "1299" } },
    );
    fireEvent.submit(
      within(dialog)
        .getByRole("button", { name: "Record movement" })
        .closest("form")!,
    );

    await waitFor(() =>
      expect(recordInventoryMovement).toHaveBeenCalledWith(
        "staff-token",
        organizationId,
        locationId,
        expect.any(String),
        {
          ingredientId,
          movementType: "RECEIPT",
          quantityDelta: "10.500000",
          sourceReference: "PO-42",
          note: undefined,
          totalCostMinor: 1299,
        },
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires adjustment reasons and reloads current data after a stock shortage", async () => {
    vi.mocked(recordInventoryMovement).mockRejectedValue(
      new InventoryError("INVENTORY_INSUFFICIENT_STOCK", 409, {
        [ingredientId]: { requested: "12.000000", available: "4.000000" },
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Record" }));
    const dialog = await screen.findByRole("dialog");
    await selectOption(within(dialog).getByLabelText("Movement type"), "Adjustment");
    fireEvent.change(within(dialog).getByLabelText("Quantity (g)"), {
      target: { value: "-12" },
    });
    const form = within(dialog)
      .getByRole("button", { name: "Record movement" })
      .closest("form")!;
    fireEvent.submit(form);

    expect(
      await within(dialog).findByText(
        "Explain why this stock adjustment is needed.",
      ),
    ).toBeInTheDocument();
    expect(recordInventoryMovement).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Adjustment reason"), {
      target: { value: "Spoilage audit" },
    });
    fireEvent.submit(form);

    expect(
      await within(dialog).findByText(
        /12\.000000 requested and 4\.000000 available/,
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(getInventoryBalances).toHaveBeenCalledTimes(2));
    expect(getInventoryMovements).toHaveBeenCalledTimes(2);
  });
});
