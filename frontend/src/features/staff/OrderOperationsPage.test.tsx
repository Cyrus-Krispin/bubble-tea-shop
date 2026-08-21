import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./orderOperationsClient", () => ({
  listStaffOrders: vi.fn(),
  getStaffOrder: vi.fn(),
  completeStaffOrder: vi.fn(),
  OrderOperationError: class OrderOperationError extends Error {
    constructor(
      public code: string,
      public status: number,
      public shortages: readonly unknown[] = [],
    ) {
      super(code);
    }
  },
}));

import OrderOperationsPage from "./OrderOperationsPage";
import {
  completeStaffOrder,
  getStaffOrder,
  listStaffOrders,
  OrderOperationError,
} from "./orderOperationsClient";

const organizationId = "88b23060-cbc4-4218-9938-63d75f6f324c";
const locationId = "42eeb769-306a-4b1a-97cc-350e2e9ea90b";
const orderId = "35f942a3-0591-4973-83ef-8889f608184e";
const outletContext = {
  accessToken: "staff-token",
  staffContext: {
    accountId: "account-id",
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
const summary = {
  id: orderId,
  publicOrderNumber: "BT0000000001",
  status: "PENDING" as const,
  paymentMethod: "CASH",
  paymentStatus: "PENDING",
  currencyCode: "SGD",
  totalMinor: 660,
  itemQuantity: 1,
  createdAt: "2026-08-22T00:00:00Z",
  completedAt: null,
};
const detail = {
  ...summary,
  subtotalMinor: 660,
  paidAt: null,
  lines: [
    {
      lineNumber: 1,
      productName: "Moonlit Milk Tea",
      variantName: "Medium",
      quantity: 1,
      unitPriceMinor: 660,
      lineTotalMinor: 660,
      options: [
        {
          selectionNumber: 1,
          groupName: "Sweetness",
          choiceName: "50%",
          priceDeltaMinor: 0,
        },
      ],
    },
  ],
  requirements: [
    {
      ingredientId: "ingredient-id",
      ingredientName: "Assam Tea",
      baseUnit: "GRAM",
      requiredQuantity: "2.500000",
      availableQuantity: "10.000000",
      sufficient: true,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/staff/orders"]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />} path="/staff">
          <Route element={<OrderOperationsPage />} path="orders" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("OrderOperationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listStaffOrders).mockResolvedValue({
      items: [summary],
      page: 0,
      size: 25,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(getStaffOrder).mockResolvedValue(detail);
    vi.mocked(completeStaffOrder).mockResolvedValue({
      ...detail,
      status: "COMPLETED",
      paymentStatus: "PAID",
      completedAt: "2026-08-22T00:05:00Z",
      paidAt: "2026-08-22T00:05:00Z",
    });
  });

  it("loads the pending location queue and server-owned detail", async () => {
    renderPage();

    expect(await screen.findByText("BT0000000001")).toBeInTheDocument();
    expect(listStaffOrders).toHaveBeenCalledWith(
      "staff-token",
      organizationId,
      locationId,
      { page: 0, size: 25, status: "PENDING" },
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("button", { name: "View BT0000000001" }));
    expect(await screen.findByText(/Moonlit Milk Tea/)).toBeInTheDocument();
    expect(screen.getByText("2.500000 g needed")).toBeInTheDocument();
    expect(getStaffOrder).toHaveBeenCalledWith(
      "staff-token",
      organizationId,
      locationId,
      orderId,
      expect.any(AbortSignal),
    );
  });

  it("confirms cash completion once and renders the paid server response", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "View BT0000000001" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Collect cash & complete" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm cash & complete" }),
    );

    expect(
      within(dialog).getByRole("button", { name: "Completing order" }),
    ).toBeDisabled();
    await waitFor(() => expect(completeStaffOrder).toHaveBeenCalledTimes(1));
    expect(completeStaffOrder).toHaveBeenCalledWith(
      "staff-token",
      organizationId,
      locationId,
      orderId,
    );
    expect(await screen.findByText("Paid · Completed")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the order pending and explains named stock shortages", async () => {
    vi.mocked(completeStaffOrder).mockRejectedValue(
      new OrderOperationError("ORDER_INSUFFICIENT_STOCK", 409, [
        {
          ...detail.requirements[0],
          availableQuantity: "1.000000",
        },
      ]),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "View BT0000000001" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Collect cash & complete" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm cash & complete" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "still pending",
    );
    expect(
      within(dialog).getByText(
        (_, element) =>
          element?.tagName === "LI" &&
          element.textContent ===
            "Assam Tea: 2.500000 g required, 1.000000 available",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("PENDING")).toHaveLength(2);
  });
});
