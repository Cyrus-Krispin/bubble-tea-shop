import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeStaffOrder,
  listStaffOrders,
  OrderOperationError,
} from "./orderOperationsClient";

const summary = {
  id: "order-id",
  publicOrderNumber: "BT0000000001",
  status: "PENDING",
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
      options: [],
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

afterEach(() => vi.unstubAllGlobals());

describe("orderOperationsClient", () => {
  it("loads a scoped filtered page with bearer authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [summary],
          page: 0,
          size: 25,
          totalItems: 1,
          totalPages: 1,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listStaffOrders("token", "org", "location", {
        status: "PENDING",
        page: 0,
        size: 25,
      }),
    ).resolves.toMatchObject({ items: [summary] });

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.headers.get("authorization")).toBe("Bearer token");
    expect(new URL(request.url).searchParams.get("status")).toBe("PENDING");
  });

  it("posts completion without a client-owned body and parses the refreshed detail", async () => {
    const completed = {
      ...detail,
      status: "COMPLETED",
      paymentStatus: "PAID",
      completedAt: "2026-08-22T00:05:00Z",
      paidAt: "2026-08-22T00:05:00Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(completed), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeStaffOrder(
      "token",
      "org",
      "location",
      "order",
    );
    expect(result).toMatchObject({
      status: "COMPLETED",
      paymentStatus: "PAID",
      completedAt: "2026-08-22T00:05:00Z",
    });
    expect(result).not.toHaveProperty("itemQuantity");
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.method).toBe("POST");
    expect(await request.text()).toBe("");
  });

  it("preserves named shortage details and rejects malformed successes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "ORDER_INSUFFICIENT_STOCK",
            shortages: [
              {
                ingredientId: "ingredient-id",
                ingredientName: "Assam Tea",
                baseUnit: "GRAM",
                requiredQuantity: "2.500000",
                availableQuantity: "1.000000",
              },
            ],
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    await expect(
      completeStaffOrder("token", "org", "location", "order"),
    ).rejects.toEqual(
      new OrderOperationError("ORDER_INSUFFICIENT_STOCK", 409, [
        {
          ingredientId: "ingredient-id",
          ingredientName: "Assam Tea",
          baseUnit: "GRAM",
          requiredQuantity: "2.500000",
          availableQuantity: "1.000000",
        },
      ]),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [{ ...summary, totalMinor: "660" }],
            page: 0,
            size: 25,
            totalItems: 1,
            totalPages: 1,
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      listStaffOrders("token", "org", "location", { page: 0, size: 25 }),
    ).rejects.toThrow("invalid staff order response");
  });
});
